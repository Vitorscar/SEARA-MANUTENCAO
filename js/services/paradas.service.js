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
  /* ---------- 1) Validações ---------- */
  const chapa      = String(payload.chapa || '').replace(/\D/g, '');
  const maquinaId  = payload.maquinaId;
  const categoria  = payload.categoria;
  const causaRaiz  = payload.causaRaiz;
  const componente = payload.componente;
  const acaoComp   = payload.acaoComponente;

  if(chapa.length !== 10) throw new Error('Chapa deve ter 10 dígitos.');
  if(!maquinaId)          throw new Error('Máquina não informada.');
  if(!categoria)          throw new Error('Tipo de falha não informado.');
  if(!causaRaiz)          throw new Error('Causa raiz não informada.');
  if(!componente)         throw new Error('Componente não informado.');
  if(!acaoComp)           throw new Error('Ação no componente não informada.');

  /* ---------- 2) Busca a máquina ---------- */
  const maq = getMaquina(maquinaId);
  if(!maq) throw new Error('Máquina não encontrada.');

  /* ---------- 3) Descobre o técnico ---------- */
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

  /* ---------- 4) Payload pra API ---------- */
  const dados = {
    maquinaId,
    setor:          maq.setor || null,
    area:           maq.area  || null,
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

  /* ---------- 5) Grava no Supabase ---------- */
  const parada = await api.paradas.criar(dados);

  /* ---------- 6) Atualiza cache local (com maquinaNome) ---------- */
  state.db.paradas = state.db.paradas || [];
  state.db.paradas.unshift({
    ...parada,
    maquinaId,
    maquinaNome: maq.nome
  });

  /* ---------- 7) Marca a máquina como parada ---------- */
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

  /* ---------- 1) Patch base (campos do form) ---------- */
  const patch = {
    categoria:      payload.categoria      || null,
    causaRaiz:      payload.causaRaiz      || null,
    componente:     payload.componente     || null,
    acaoComponente: payload.acaoComponente || null,
    acaoPreventiva: payload.acaoPreventiva || null,
    observacao:     payload.observacao     || null
  };

  /* ---------- 2) Chama a API conforme o modo ---------- */
  let paradaAtualizada;

  if(opts.encerrar){
    paradaAtualizada = await api.paradas.encerrar(id, patch);
  } else {
    /* Edição sem encerrar — update direto */
    paradaAtualizada = await api.paradas.atualizar(id, patch);
  }

  /* ---------- 3) Sincroniza cache local ---------- */
  const local = (state.db.paradas || []).find(p => p.id === id);
  if(local){
    Object.assign(local, paradaAtualizada || {}, patch);
  }

  /* ---------- 4) Libera a máquina se encerrou ---------- */
  if(opts.encerrar){
    const maqId = paradaAtualizada?.maquinaId || local?.maquinaId;
    const maq   = (state.db.maquinas || []).find(m => m.id === maqId);

    if(maq) maq.status = 'operando';

    if(maqId){
      try {
        await api.maquinas.atualizar(maqId, { status: 'operando' });
      } catch(err){
        console.warn('[paradas] máquina não foi liberada:', err.message);
      }
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