/* =========================================================
   paradas.service.js — criar / editar / encerrar parada
   Grava no Supabase + mantém o cache local sincronizado
   ========================================================= */

import { state, salvarDB, getMaquina } from '../core/state.js';
import { api }                         from '../data/api.js';

/* =========================================================
   CRIAR PARADA
   ========================================================= */
export async function criarParada(payload){
  /* ---------- 1) Coleta e validações básicas ---------- */
  const chapa      = String(payload.chapa || '').replace(/\D/g, '');
  const maquinaId  = payload.maquinaId;
  const setor      = String(payload.setor || '').trim();
  const categoria  = payload.categoria;
  const causaRaiz  = payload.causaRaiz;
  const componente = payload.componente;
  const acaoComp   = payload.acaoComponente;

  if(chapa.length !== 10) throw new Error('Chapa deve ter 10 dígitos.');
  if(!maquinaId)          throw new Error('Máquina não informada.');
  if(!setor)              throw new Error('Setor não informado.');
  if(!categoria)          throw new Error('Tipo de falha não informado.');
  if(!causaRaiz)          throw new Error('Causa raiz não informada.');
  if(!componente)         throw new Error('Componente não informado.');
  if(!acaoComp)           throw new Error('Ação no componente não informada.');

  /* ---------- 2) Busca a máquina ---------- */
  const maq = getMaquina(maquinaId);
  if(!maq) throw new Error('Máquina não encontrada.');

  /* ---------- 3) 🆕 Defesa em profundidade: setor ↔ máquina ---------- */
  /* Garante que a máquina realmente pertence ao setor selecionado */
  if(maq.setor && maq.setor !== setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${setor}". ` +
      `Ela está cadastrada em "${maq.setor}".`
    );
  }

  /* ---------- 4) Descobre o técnico ---------- */
  const user = state.db?.currentUser;
  let tecnicoId       = user?.id || null;
  let responsavelNome = payload.responsavel || user?.nome || null;

  /* Se a chapa digitada não é a do usuário logado, busca o técnico real */
  if(chapa !== user?.chapa){
    const outro = (state.db.tecnicos || []).find(t => t.chapa === chapa);
    if(outro){
      tecnicoId       = outro.id;
      responsavelNome = responsavelNome || outro.nome;
    } else {
      /* Chapa não cadastrada localmente — salva órfã só com a chapa */
      tecnicoId = null;
    }
  }

  /* ---------- 5) Payload pra API ---------- */
  /* ⚠️ Usa o `setor` do payload (validado contra a máquina), não o da máquina */
  const dados = {
    maquinaId,
    setor,
    area:           payload.area || maq.area || null,
    turno:          payload.turno,
    impacto:        payload.impacto || 'Alto',
    status:         'aguardando',

    tecnicoId,
    responsavel:    responsavelNome,
    chapaTecnico:   chapa,

    categoria,
    causaRaiz,
    componente,

    acaoComponente: acaoComp,
    acaoPreventiva: payload.acaoPreventiva || 'Nenhuma',

    observacao:     payload.observacao || null
  };

  /* ---------- 6) Grava no Supabase ---------- */
  const parada = await api.paradas.criar(dados);

  /* ---------- 7) Atualiza cache local (com maquinaNome) ---------- */
  state.db.paradas = state.db.paradas || [];
  state.db.paradas.unshift({
    ...parada,
    maquinaId,
    maquinaNome: maq.nome,
    setor,                              /* reforça o setor no cache */
    area: payload.area || maq.area || ''
  });

  /* ---------- 8) Marca a máquina como parada ---------- */
  maq.status = 'parada';
  try {
    await api.maquinas.atualizar(maquinaId, { status: 'parada' });
  } catch(err){
    console.warn('[paradas] status da máquina não sincronizou:', err.message);
  }

  salvarDB();
  return parada;
}

/* =========================================================
   EDITAR / ENCERRAR PARADA
   opts.encerrar = true → muda status e hora_fim
   ========================================================= */
export async function atualizarParada(id, payload, opts = {}){
  if(!id) throw new Error('ID da parada não informado.');

  /* ---------- 1) Busca a parada atual no cache ---------- */
  const local = (state.db.paradas || []).find(p => p.id === id);

  /* ---------- 2) Se veio setor, valida contra a máquina ---------- */
  const maqId = payload.maquinaId || local?.maquinaId;
  const maq   = maqId ? getMaquina(maqId) : null;

  if(payload.setor && maq?.setor && maq.setor !== payload.setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${payload.setor}".`
    );
  }

  /* ---------- 3) Patch base (campos do form) ---------- */
  const patch = {
    categoria:      payload.categoria      || null,
    causaRaiz:      payload.causaRaiz      || null,
    componente:     payload.componente     || null,
    acaoComponente: payload.acaoComponente || null,
    acaoPreventiva: payload.acaoPreventiva || null,
    observacao:     payload.observacao     || null
  };

  /* Se veio setor/area (no modo encerrar completo), inclui no patch */
  if(payload.setor) patch.setor = payload.setor;
  if(payload.area)  patch.area  = payload.area;

  /* ---------- 4) Chama a API conforme o modo ---------- */
  let paradaAtualizada;

  if(opts.encerrar){
    paradaAtualizada = await api.paradas.encerrar(id, patch);
  } else {
    paradaAtualizada = await api.paradas.atualizar(id, patch);
  }

  /* ---------- 5) Sincroniza cache local ---------- */
  if(local){
    Object.assign(local, paradaAtualizada || {}, patch);
  }

  /* ---------- 6) Libera a máquina se encerrou ---------- */
  if(opts.encerrar && maqId){
    const m = (state.db.maquinas || []).find(x => x.id === maqId);
    if(m) m.status = 'operando';

    try {
      await api.maquinas.atualizar(maqId, { status: 'operando' });
    } catch(err){
      console.warn('[paradas] máquina não foi liberada:', err.message);
    }
  }

  salvarDB();
  return paradaAtualizada;
}

/* =========================================================
   HELPERS
   ========================================================= */
export function getParadaAberta(){
  return (state.db.paradas || []).find(p => p.status !== 'encerrada') || null;
}

export function totalParadasAbertas(){
  return (state.db.paradas || []).filter(p => p.status !== 'encerrada').length;
}

export function getParada(id){
  return (state.db.paradas || []).find(p => p.id === id) || null;
}

/* 🆕 Retorna todas as paradas abertas de uma máquina específica */
export function getParadasAbertasDaMaquina(maquinaId){
  return (state.db.paradas || []).filter(
    p => p.maquinaId === maquinaId && p.status !== 'encerrada'
  );
}