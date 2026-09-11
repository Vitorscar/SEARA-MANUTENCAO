/* Helpers puros — sem DOM, sem estado */

export function fmtMin(ms){
  const min = Math.max(0, Math.floor(ms/60000));
  const h = Math.floor(min/60), m = min%60;
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}

export function fmtDuracaoMin(min){
  const h = Math.floor(min/60), m = min%60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function minutosDesde(iso){
  return Math.max(0, Math.round((Date.now() - iso)/60000));
}

export function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function nowStr(){
  const d = new Date();
  return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

export function turnoPorHora(h){
  if(h >= 6  && h < 14) return '1º Turno';
  if(h >= 14 && h < 22) return '2º Turno';
  return '3º Turno';
}

export function turnoAtual(){ return turnoPorHora(new Date().getHours()); }

export function impactoCor(i){
  return {
    'Baixo':'#1E7A3D','Médio':'#D89A00','Alto':'#C77700','Crítico':'#C8102E'
  }[i] || '#6B6460';
}