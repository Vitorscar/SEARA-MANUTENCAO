/* =========================================================
   paradas.service.js
   ========================================================= */

import { state, salvarDB } from '../core/state.js';
import { api }             from '../data/api.js';

/* =========================================================
   CRIAR PARADA
   ========================================================= */
export async function criarParada(payload){
  /* 1) Mapeia os campos do form → colunas da tabela */
  const dados = {
    maquinaId:      payload.maquinaId,
    setor:          payload.setor || null,
    area:           payload.area || null,
    turno:          payload.turno,
    impacto:        payload.impacto || 'Alto',
    status:         'aguardando',

    tecnicoId:      state.db?.currentUser?.id || null,
    responsavel:    payload.responsavel,
    chapaTecnico:   payload.chapa,

    categoria:      payload.categoria,
    causaRaiz:      payload.causaRaiz,
    componente:     payload.componente,

    acaoComponente: payload.acaoComponente,
    acaoPreventiva: payload.acaoPreventiva,

    observacao:     payload.observacao,
    data:           payload.data
  };

  /* 2) Vai pro Supabase */
  const parada = await api.paradas.criar(dados);

  /* 3) Atualiza o cache local (pra UI refletir na hora) */
  state.db.paradas = state.db.paradas || [];
  state.db.paradas.unshift(parada);

  /* 4) Marca a máquina como parada */
  const maq = (state.db.maquinas || []).find(m => m.id === dados.maquinaId);
  if(maq) maq.status = 'parada';

  salvarDB();

  return parada;
}

/* =========================================================
   ENCERRAR PARADA
   ========================================================= */
export async function atualizarParada(id, payload, opts = {}){
  const patch = {
    categoria:      payload.categoria,
    causaRaiz:      payload.causaRaiz,
    componente:     payload.componente,
    acaoComponente: payload.acaoComponente,
    acaoPreventiva: payload.acaoPreventiva,
    observacao:     payload.observacao
  };

  /* Encerrar → mexe no status e hora fim */
  const parada = await api.paradas.encerrar(id, patch);

  /* Atualiza cache local */
  const local = (state.db.paradas || []).find(p => p.id === id);
  if(local){
    Object.assign(local, parada);
  }

  /* Máquina volta a operar */
  if(opts.encerrar && parada.maquinaId){
    const maq = (state.db.maquinas || []).find(m => m.id === parada.maquinaId);
    if(maq) maq.status = 'operando';
  }

  salvarDB();
  return parada;
}