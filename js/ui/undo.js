/* Barra "desfazer" (6s) + execução da ação desfeita */

import { state, salvarDB } from '../core/state.js';
import { toast } from './toast.js';
import { emit } from '../core/events.js';

export function registrarDesfazer(texto, fn){
  state.ultimaAcao = fn;
  document.getElementById('undoText').textContent = texto;
  document.getElementById('undoBar').classList.add('show');
  clearTimeout(state.undoTimer);
  state.undoTimer = setTimeout(() => {
    document.getElementById('undoBar').classList.remove('show');
    state.ultimaAcao = null;
  }, 6000);
}

export function desfazer(){
  if(state.ultimaAcao) state.ultimaAcao();
  document.getElementById('undoBar').classList.remove('show');
  state.ultimaAcao = null;
  clearTimeout(state.undoTimer);
  salvarDB();
  toast('Ação desfeita');
  emit('undo:aplicado');
}