import { state, salvarDB } from '../core/state.js';

export function acharOuCriarMaquina(nome, setor, area = null) {
  let maq = state.db.maquinas.find(m => m.nome.toLowerCase() === nome.toLowerCase());
  
  if (!maq) {
    maq = {
      id: 'm' + Date.now(),
      nome,
      setor,
      area,
      prioridade: 2,
      status: 'operando', // Corrigido: era 'parada', agora bate com a view
      qr: ''
    };
    state.db.maquinas.push(maq);
    salvarDB();
  }
  return maq;
}

export function criarMaquina({ nome, setor, area = null, qr_code = null, prioridade = 2 }) {
  const maq = {
    id: 'm' + Date.now(),
    nome,
    setor,
    area,       // Agora é salvo corretamente
    prioridade: parseInt(prioridade, 10),
    status: 'operando', // Corrigido: era 'ok', a view espera 'operando'
    qr: qr_code // Agora é salvo corretamente
  };
  
  state.db.maquinas.push(maq);
  salvarDB();
  return maq;
}