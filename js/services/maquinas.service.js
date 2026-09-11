import { state, salvarDB } from '../core/state.js';

export function acharOuCriarMaquina(nome, setor){
  let maq = state.db.maquinas.find(m => m.nome.toLowerCase() === nome.toLowerCase());
  if(!maq){
    maq = {id:'m'+Date.now(), nome, setor, prioridade:2, status:'parada', qr:''};
    state.db.maquinas.push(maq);
  }
  return maq;
}

export function criarMaquina({nome, setor, prioridade}){
  const maq = {id:'m'+Date.now(), nome, setor, prioridade, status:'ok', qr:''};
  state.db.maquinas.push(maq);
  salvarDB();
  return maq;
}