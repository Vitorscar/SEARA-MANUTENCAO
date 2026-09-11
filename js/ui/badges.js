import { state } from '../core/state.js';

export function atualizarBadges(){
  const abertas = state.db.paradas.filter(p => p.status !== 'encerrada').length;
  ['navRadarCount','navRadarCount2'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.textContent = abertas;
    el.classList.toggle('hidden', abertas === 0);
  });
}