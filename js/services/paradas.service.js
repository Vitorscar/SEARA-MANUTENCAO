import { state, salvarDB, getMaquina } from '../core/state.js';
import { acharOuCriarMaquina } from './maquinas.service.js';
import { criarOS } from './os.service.js';
import { emit } from '../core/events.js';

export function criarParada(dados){
  const maq = acharOuCriarMaquina(dados.maquinaNome, dados.setor);

  const parada = {
    id:'p'+Date.now(),
    numero: state.db.seqParada++,
    maquinaId: maq.id,
    setor: dados.setor,
    turno: dados.turno,
    horaInicio: Date.now(),
    horaFim: null,
    duracaoMin: dados.duracao ? parseInt(dados.duracao, 10) : null,
    impacto: dados.impacto,
    status:'aguardando',
    tecnicoId:null,
    categoria: dados.categoria,
    subcausa: dados.subcausa || '—',
    componente: dados.componente,
    causaRaiz: dados.causaRaiz,
    acaoComponente: dados.acaoComponente,
    acaoPreventiva: dados.acaoPreventiva || '—',
    responsavel: dados.responsavel,
    observacao: dados.observacao,
    foto: dados.foto,
    anexos: dados.anexos || [],
};


  state.db.paradas.unshift(parada);
  maq.status = 'parada';
  criarOS(parada, maq.id, parada.causaRaiz || parada.categoria);

  salvarDB();
  emit('parada:criada', parada);
  return { parada, maquina: maq };
}

export function atualizarParada(id, dados, opts = {}){
  const p = state.db.paradas.find(x => x.id === id);
  if(!p) return null;

  p.setor          = dados.setor;
  p.turno          = dados.turno;
  p.duracaoMin     = dados.duracao ? parseInt(dados.duracao, 10) : p.duracaoMin;
  p.impacto        = dados.impacto;
  p.categoria      = dados.categoria;
  p.subcausa       = dados.subcausa || '—';
  p.componente     = dados.componente;
  p.causaRaiz      = dados.causaRaiz;
  p.acaoComponente = dados.acaoComponente;
  p.acaoPreventiva = dados.acaoPreventiva || '—';
  p.responsavel    = dados.responsavel;
  p.observacao     = dados.observacao;
  p.foto           = dados.foto;

  if(opts.encerrar && p.status !== 'encerrada'){
    p.status     = 'encerrada';
    p.horaFim    = Date.now();
    p.duracaoMin = Math.round((p.horaFim - p.horaInicio) / 60000);
    const m = getMaquina(p.maquinaId); if(m) m.status = 'ok';
    const os = state.db.os.find(o => o.paradaId === p.id); if(os) os.coluna = 'concluido';
  }

  salvarDB();
  emit('parada:atualizada', p);
  return p;
}

export function assumirParada(id, tecnicoId){
  const p = state.db.paradas.find(x => x.id === id);
  if(!p) return null;

  const antes = { status: p.status, tecnicoId: p.tecnicoId };
  p.status     = 'atendendo';
  p.tecnicoId  = tecnicoId;

  const os = state.db.os.find(o => o.paradaId === p.id);
  if(os){ os.coluna = 'andamento'; os.tecnicoId = tecnicoId; }

  salvarDB();
  emit('parada:assumida', p);
  return { parada: p, os, antes };
}

export function removerParada(id){
  state.db.paradas = state.db.paradas.filter(p => p.id !== id);
  state.db.os      = state.db.os.filter(o => o.paradaId !== id);
  salvarDB();
  emit('parada:removida', id);
}