import { state, salvarDB, getMaquina } from '../core/state.js';
import { emit } from '../core/events.js';

export function criarTecnico({ nome, especialidade, matricula, role='tecnico', turno='1º Turno' }){
  if(!nome?.trim()) throw new Error('Nome obrigatório');
  if(state.db.tecnicos.some(t => t.matricula === matricula)) {
    throw new Error('Matrícula já cadastrada');
  }
  const t = {
    id: 't' + Date.now(),
    nome: nome.trim(),
    especialidade,
    matricula,
    role,
    turno,
    ativo: true
  };
  state.db.tecnicos.push(t);
  salvarDB();
  emit('tecnico:criado', t);
  return t;
}

export function atualizarTecnico(id, patch){
  const t = state.db.tecnicos.find(x => x.id === id);
  if(!t) return null;
  Object.assign(t, patch);
  salvarDB();
  emit('tecnico:atualizado', t);
  return t;
}

export function desativarTecnico(id){
  const t = state.db.tecnicos.find(x => x.id === id);
  if(!t) return null;
  t.ativo = false;
  salvarDB();
  emit('tecnico:desativado', t);
  return t;
}

/* Direciona técnico para uma parada específica (assumir) */
export function direcionarParaParada(tecnicoId, paradaId){
  const parada = state.db.paradas.find(p => p.id === paradaId);
  const tecnico = state.db.tecnicos.find(t => t.id === tecnicoId);
  if(!parada || !tecnico) return null;

  parada.status = 'atendendo';
  parada.tecnicoId = tecnicoId;

  const os = state.db.os.find(o => o.paradaId === paradaId);
  if(os){ os.coluna = 'andamento'; os.tecnicoId = tecnicoId; }

  salvarDB();
  emit('tecnico:direcionado', { tecnicoId, paradaId });
  return parada;
}

/* Estatísticas de um técnico — usadas no card da Equipe */
export function getEstatisticasTecnico(tecnicoId){
  const paradas = state.db.paradas.filter(p => p.tecnicoId === tecnicoId);
  const encerradas = paradas.filter(p => p.status === 'encerrada');
  const mttr = encerradas.length
    ? Math.round(encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0) / encerradas.length)
    : null;

  const hoje = new Date().toISOString().slice(0,10);
  const hojeEncerradas = encerradas.filter(p =>
    p.horaFim && new Date(p.horaFim).toISOString().slice(0,10) === hoje
  );

  return {
    total: paradas.length,
    hoje: hojeEncerradas.length,
    mttr
  };
}