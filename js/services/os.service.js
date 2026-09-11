import { state, salvarDB, getMaquina } from '../core/state.js';

export function criarOS(parada, maquinaId, titulo){
  const os = {
    id:'os'+Date.now(),
    paradaId: parada.id,
    maquinaId,
    titulo,
    coluna:'fila',
    tecnicoId:null
  };
  state.db.os.unshift(os);
  return os;
}

export function moverOS(osId, coluna){
  const os = state.db.os.find(o => o.id === osId);
  if(!os) return null;
  os.coluna = coluna;

  const p = state.db.paradas.find(p => p.id === os.paradaId);
  if(p){
    if(coluna === 'andamento') p.status = 'atendendo';
    if(coluna === 'concluido' && p.status !== 'encerrada'){
      p.status = 'encerrada';
      p.horaFim = Date.now();
      p.duracaoMin = Math.round((p.horaFim - p.horaInicio) / 60000);
      const m = getMaquina(p.maquinaId); if(m) m.status = 'ok';
    }
  }
  salvarDB();
  return os;
}