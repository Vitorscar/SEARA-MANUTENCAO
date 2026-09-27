/* =========================================================
   paradas.service.js — criar / editar parada
   🆕 Só existe criarParada. O técnico registra JÁ com:
       • status escolhido ('encerrada' | 'atendendo')
       • tempo total em texto livre → duracao_min
   ========================================================= */

import { state, salvarDB, getMaquina } from '../core/state.js';
import { api }                         from '../data/api.js';

/* =========================================================
   PARSE DE DURAÇÃO — texto livre → minutos
   Aceita: 45 | 45min | 45m | 1h | 1h30 | 1h30min | 2:30 | 1,5h
   ========================================================= */
export function parseDuracao(texto){
  if(!texto) return 0;

  const s = String(texto)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');

  /* 1h30 | 1h30min | 1h */
  let m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d+(?:\.\d+)?)m(?:in)?)?$/);
  if(m){
    const h   = parseFloat(m[1]) || 0;
    const min = parseFloat(m[2]) || 0;
    return Math.round(h * 60 + min);
  }

  /* 1:30 | 01:30 */
  m = s.match(/^(\d+):(\d{1,2})$/);
  if(m){
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  /* 45min | 45m */
  m = s.match(/^(\d+(?:\.\d+)?)(?:min|m)$/);
  if(m){
    return Math.round(parseFloat(m[1]));
  }

  /* 45 (só número = minutos) */
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if(m){
    return Math.round(parseFloat(m[1]));
  }

  return 0;
}

/* =========================================================
   CRIAR PARADA — única operação de escrita
   ========================================================= */
export async function criarParada(payload){
  /* ---------- Validações ---------- */
  const chapa      = String(payload.chapa || '').replace(/\D/g, '');
  const maquinaId  = payload.maquinaId;
  const setor      = String(payload.setor || '').trim();
  const categoria  = payload.categoria;
  const causaRaiz  = payload.causaRaiz;
  const componente = payload.componente;
  const acaoComp   = payload.acaoComponente;
  const status     = payload.status || 'encerrada';

  if(chapa.length !== 10) throw new Error('Chapa deve ter 10 dígitos.');
  if(!maquinaId)          throw new Error('Máquina não informada.');
  if(!setor)              throw new Error('Setor não informado.');
  if(!categoria)          throw new Error('Tipo de falha não informado.');
  if(!causaRaiz)          throw new Error('Causa raiz não informada.');
  if(!componente)         throw new Error('Componente não informado.');
  if(!acaoComp)           throw new Error('Ação no componente não informada.');

  /* ---------- Parse do tempo (obrigatório) ---------- */
  const tempoTxt = String(payload.tempoTotal || '').trim();
  if(!tempoTxt){
    throw new Error('Informe o tempo total (ex: 45min, 1h30, 2h).');
  }
  const duracaoMin = parseDuracao(tempoTxt);
  if(duracaoMin <= 0){
    throw new Error('Tempo total inválido. Use: 45min, 1h30, 2h, 90.');
  }

  /* ---------- Máquina ---------- */
  const maq = getMaquina(maquinaId);
  if(!maq) throw new Error('Máquina não encontrada.');

  if(maq.setor && maq.setor !== setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${setor}". ` +
      `Ela está cadastrada em "${maq.setor}".`
    );
  }

  /* ---------- Técnico ---------- */
  const user = state.db?.currentUser;
  let tecnicoId       = user?.id || null;
  let responsavelNome = payload.responsavel || user?.nome || null;

  if(chapa !== user?.chapa){
    const outro = (state.db.tecnicos || []).find(t => t.chapa === chapa);
    if(outro){
      tecnicoId       = outro.id;
      responsavelNome = responsavelNome || outro.nome;
    } else {
      tecnicoId = null;
    }
  }

  /* ---------- Payload final ---------- */
  const dados = {
    maquinaId,
    setor,
    area:           payload.area || maq.area || null,
    turno:          payload.turno,
    impacto:        payload.impacto || 'Alto',
    status,

    tecnicoId,
    responsavel:    responsavelNome,
    chapaTecnico:   chapa,

    categoria,
    causaRaiz,
    componente,

    acaoComponente: acaoComp,
    acaoPreventiva: payload.acaoPreventiva || 'Nenhuma',

    observacao:     payload.observacao || null,

    duracaoMin
  };

  /* ---------- Grava ---------- */
  const parada = await api.paradas.criar(dados);

  /* ---------- Cache local ---------- */
  state.db.paradas = state.db.paradas || [];
  state.db.paradas.unshift({
    ...parada,
    maquinaId,
    maquinaNome: maq.nome,
    setor,
    area: payload.area || maq.area || ''
  });

  /* Marca a máquina como parada só se ficou em andamento */
  if(status === 'atendendo'){
    maq.status = 'parada';
    try {
      await api.maquinas.atualizar(maquinaId, { status: 'parada' });
    } catch(err){
      console.warn('[paradas] status da máquina não sincronizou:', err.message);
    }
  }

  salvarDB();
  return parada;
}

/* =========================================================
   ATUALIZAR (edições pontuais)
   ========================================================= */
export async function atualizarParada(id, payload){
  if(!id) throw new Error('ID da parada não informado.');

  const local = (state.db.paradas || []).find(p => p.id === id);

  const maqId = payload.maquinaId || local?.maquinaId;
  const maq   = maqId ? getMaquina(maqId) : null;

  if(payload.setor && maq?.setor && maq.setor !== payload.setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${payload.setor}".`
    );
  }

  const patch = {
    categoria:      payload.categoria      || null,
    causaRaiz:      payload.causaRaiz      || null,
    componente:     payload.componente     || null,
    acaoComponente: payload.acaoComponente || null,
    acaoPreventiva: payload.acaoPreventiva || null,
    observacao:     payload.observacao     || null
  };

  if(payload.setor) patch.setor = payload.setor;
  if(payload.area)  patch.area  = payload.area;

  const paradaAtualizada = await api.paradas.atualizar(id, patch);

  if(local){
    Object.assign(local, paradaAtualizada || {}, patch);
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

export function getParadasAbertasDaMaquina(maquinaId){
  return (state.db.paradas || []).filter(
    p => p.maquinaId === maquinaId && p.status !== 'encerrada'
  );
}
