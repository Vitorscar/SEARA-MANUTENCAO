/* =========================================================
   relatorios.service.js — KPIs de manutenção industrial
   ========================================================= */

import { state, getMaquina, getTecnico } from '../core/state.js';

const DIAS_POR_PERIODO = { '7d':7, '30d':30, '90d':90, 'all':99999 };
const DOW_LABELS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function aplicarFiltros(paradas, f){
  const dias = DIAS_POR_PERIODO[f.periodo] || 30;
  const limite = Date.now() - dias * 86400000;
  return paradas.filter(p => {
    if(p.horaInicio < limite) return false;
    if(f.tecnicoId && p.tecnicoId !== f.tecnicoId) return false;
    if(f.maquinaId && p.maquinaId !== f.maquinaId) return false;
    if(f.turno && p.turno !== f.turno) return false;
    if(f.categoria && p.categoria !== f.categoria) return false;
    return true;
  });
}

export function getRelatorio(filtros){
  const todasEncerradas = state.db.paradas.filter(p => p.status === 'encerrada');
  const base = aplicarFiltros(todasEncerradas, filtros);
  const abertas = state.db.paradas.filter(p => p.status !== 'encerrada');

  /* ============ KPIs ============ */
  const totalMin = base.reduce((s,p) => s + (p.duracaoMin || 0), 0);
  const mttr = base.length ? Math.round(totalMin / base.length) : null;

  /* MTBF = tempo operando / nº de falhas. Usa janela do período. */
  const dias = DIAS_POR_PERIODO[filtros.periodo] || 30;
  const horasPeriodo = dias * 24;
  const mtbf = base.length ? (horasPeriodo * 60 - totalMin) / base.length : null;

  /* Disponibilidade = (tempo total - tempo parado) / tempo total */
  const disponibilidade = horasPeriodo * 60
    ? Math.max(0, (horasPeriodo * 60 - totalMin) / (horasPeriodo * 60)) * 100
    : 100;

  /* Tempo médio de RESPOSTA (parada → técnico assume) */
  const respostas = base.filter(p => p.horaAssumida).map(p => p.horaAssumida - p.horaInicio);
  const mttResposta = respostas.length
    ? Math.round(respostas.reduce((a,b) => a+b, 0) / respostas.length / 60000)
    : null;

  /* Tempo médio de REPARO (assume → encerra) */
  const reparos = base.filter(p => p.horaAssumida && p.horaFim)
                      .map(p => p.horaFim - p.horaAssumida);
  const mttReparo = reparos.length
    ? Math.round(reparos.reduce((a,b) => a+b, 0) / reparos.length / 60000)
    : null;

  const criticas = base.filter(p => p.impacto === 'Crítico').length;

  /* ============ Tendência (por dia) ============ */
  const tendencia = [];
  for(let i = dias - 1; i >= 0; i--){
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0,10);
    const doDia = base.filter(p => p.horaFim &&
      new Date(p.horaFim).toISOString().slice(0,10) === key);
    tendencia.push({
      dia: d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      total: doDia.length,
      mttr: doDia.length
        ? Math.round(doDia.reduce((s,p) => s + p.duracaoMin, 0) / doDia.length)
        : 0,
      minutos: doDia.reduce((s,p) => s + p.duracaoMin, 0)
    });
  }
  const tendenciaVisivel = tendencia.slice(-14); // últimas 2 semanas

  /* ============ Pareto de causas ============ */
  const porSub = {};
  base.forEach(p => {
    const k = p.subcausa || p.categoria || 'Sem categoria';
    porSub[k] = porSub[k] || { count: 0, minutos: 0 };
    porSub[k].count++;
    porSub[k].minutos += p.duracaoMin || 0;
  });
  const paretoOrdenado = Object.entries(porSub)
    .map(([label, v]) => ({ label, ...v }))
    .sort((a,b) => b.minutos - a.minutos);
  const totalMinPareto = paretoOrdenado.reduce((s,x) => s + x.minutos, 0) || 1;
  let acumulado = 0;
  const pareto = paretoOrdenado.slice(0, 8).map(x => {
    acumulado += x.minutos;
    return { ...x, acumuladoPct: Math.round(acumulado / totalMinPareto * 100) };
  });

  /* ============ Heatmap Turno × Dia ============ */
  const turnos = ['1º Turno','2º Turno','3º Turno'];
  const heatmap = Array.from({ length: 7 }, () => turnos.map(() => 0));
  base.forEach(p => {
    const d = new Date(p.horaInicio).getDay();
    const tIdx = turnos.indexOf(p.turno);
    if(tIdx >= 0) heatmap[d][tIdx]++;
  });
  const heatmapMax = Math.max(1, ...heatmap.flat());

  /* ============ Top 5 máquinas ============ */
  const porMaq = {};
  base.forEach(p => {
    const m = getMaquina(p.maquinaId);
    const n = m?.nome || '—';
    porMaq[n] = porMaq[n] || { count: 0, minutos: 0 };
    porMaq[n].count++;
    porMaq[n].minutos += p.duracaoMin || 0;
  });
  const topMaquinas = Object.entries(porMaq)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a,b) => b.minutos - a.minutos)
    .slice(0, 5);

  /* ============ Top 5 técnicos ============ */
  const porTec = {};
  base.forEach(p => {
    if(!p.tecnicoId) return;
    const t = getTecnico(p.tecnicoId);
    if(!t) return;
    porTec[t.nome] = porTec[t.nome] || { count: 0, minutos: 0 };
    porTec[t.nome].count++;
    porTec[t.nome].minutos += p.duracaoMin || 0;
  });
  const topTecnicos = Object.entries(porTec)
    .map(([nome, v]) => ({
      nome,
      count: v.count,
      mttr: Math.round(v.minutos / v.count)
    }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 5);

  /* ============ Distribuição horária ============ */
  const porHora = Array(24).fill(0);
  base.forEach(p => {
    const h = new Date(p.horaInicio).getHours();
    porHora[h]++;
  });

  /* ============ Donut por categoria ============ */
  const porCat = {};
  base.forEach(p => {
    const c = p.categoria || 'Sem categoria';
    porCat[c] = (porCat[c] || 0) + (p.duracaoMin || 0);
  });
  const categorias = Object.entries(porCat)
    .map(([label, value]) => ({ label, value }))
    .sort((a,b) => b.value - a.value);

  return {
    kpis: {
      total: base.length,
      totalMin,
      mttr,
      mtbf: mtbf ? Math.round(mtbf) : null,
      disponibilidade: Math.round(disponibilidade * 10) / 10,
      mttResposta,
      mttReparo,
      criticas,
      abertasAgora: abertas.length
    },
    tendencia: tendenciaVisivel,
    pareto,
    heatmap: { dados: heatmap, max: heatmapMax, turnos },
    topMaquinas,
    topTecnicos,
    porHora,
    categorias
  };
}

export { DOW_LABELS };