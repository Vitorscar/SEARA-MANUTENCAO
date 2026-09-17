/* =========================================================
   relatorios.service.js — agregações com filtro
   ========================================================= */

import { state, getMaquina, getTecnico } from '../core/state.js';

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

/* =========================================================
   HELPERS
   ========================================================= */
function tsDeData(str){
  if(!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0).getTime();
}
function tsFimDoDia(str){
  if(!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).getTime();
}
function minutosDecorridos(p){
  if(!p.horaInicio) return 0;
  if(p.horaFim) return p.duracaoMin || 0;
  return Math.round((Date.now() - p.horaInicio) / 60000);
}
function labelMesDia(ts){
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

/* =========================================================
   FILTRO BASE
   ========================================================= */
export function filtrarParadas({ inicio, fim, setor, tecnicoId } = {}){
  const t0 = tsDeData(inicio);
  const t1 = tsFimDoDia(fim);

  return (state.db?.paradas || []).filter(p => {
    if(t0 && p.horaInicio < t0) return false;
    if(t1 && p.horaInicio > t1) return false;
    if(setor && p.setor !== setor) return false;
    if(tecnicoId && p.tecnicoId !== tecnicoId) return false;
    return true;
  });
}

/* =========================================================
   1) RELATÓRIO GERAL
   ========================================================= */
export function relatorioGeral(filtros){
  const paradas = filtrarParadas(filtros);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  const totalMin = encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0);
  const mttr     = encerradas.length
    ? Math.round(totalMin / encerradas.length)
    : null;

  /* KPIs */
  const kpis = {
    total:          paradas.length,
    encerradas:     encerradas.length,
    abertas:        paradas.length - encerradas.length,
    criticas:       paradas.filter(p => p.impacto === 'Crítico').length,
    tempoTotalMin:  totalMin,
    mttr
  };

  /* Pareto por categoria */
  const porCat = {};
  encerradas.forEach(p => {
    const k = p.categoria || 'Sem categoria';
    porCat[k] = (porCat[k] || 0) + (p.duracaoMin || 0);
  });
  const maxCat = Math.max(...Object.values(porCat), 1);
  const pareto = Object.entries(porCat)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, min]) => ({
      label, minutos: min,
      pct: Math.round((min / maxCat) * 100)
    }));

  /* Distribuição por dia (últimos N dias do range) */
  const porDia = {};
  encerradas.forEach(p => {
    const key = new Date(p.horaInicio).toISOString().slice(0,10);
    porDia[key] = (porDia[key] || 0) + 1;
  });
  const tendencia = Object.entries(porDia)
    .sort(([a],[b]) => a.localeCompare(b))
    .slice(-14)
    .map(([dia, count]) => ({ dia: labelMesDia(new Date(dia).getTime()), count }));

  /* Turno */
  const porTurno = {};
  paradas.forEach(p => {
    porTurno[p.turno] = (porTurno[p.turno] || 0) + 1;
  });

  /* Top máquinas */
  const porMaq = {};
  encerradas.forEach(p => {
    const m = getMaquina(p.maquinaId);
    const k = m?.nome || '—';
    porMaq[k] = porMaq[k] || { count:0, minutos:0 };
    porMaq[k].count++;
    porMaq[k].minutos += p.duracaoMin || 0;
  });
  const topMaquinas = Object.entries(porMaq)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a,b) => b.minutos - a.minutos)
    .slice(0, 8);

  return { kpis, pareto, tendencia, porTurno, topMaquinas, paradas };
}

/* =========================================================
   2) RELATÓRIO POR MÁQUINA
   ========================================================= */
export function relatorioPorMaquina(filtros){
  const paradas = filtrarParadas(filtros);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  /* Agrupa por máquina */
  const porMaq = {};
  paradas.forEach(p => {
    const m = getMaquina(p.maquinaId);
    const id = p.maquinaId;
    if(!porMaq[id]){
      porMaq[id] = {
        id,
        nome: m?.nome || '—',
        setor: m?.setor || '—',
        area: m?.area || '',
        total: 0,
        abertas: 0,
        encerradas: 0,
        minutosTotal: 0,
        categorias: {},
        ultimaParada: null
      };
    }
    const g = porMaq[id];
    g.total++;
    if(p.status === 'encerrada'){
      g.encerradas++;
      g.minutosTotal += p.duracaoMin || 0;
    } else {
      g.abertas++;
    }
    const cat = p.categoria || 'Sem categoria';
    g.categorias[cat] = (g.categorias[cat] || 0) + 1;
    if(!g.ultimaParada || p.horaInicio > g.ultimaParada){
      g.ultimaParada = p.horaInicio;
    }
  });

  const maquinas = Object.values(porMaq).sort((a,b) => b.total - a.total);

  /* KPIs */
  const kpis = {
    maquinasAfetadas: maquinas.length,
    totalParadas:     paradas.length,
    maquinaTop:       maquinas[0]?.nome || '—',
    tempoTotalMin:    encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0)
  };

  /* Setores únicos */
  const setores = [...new Set(maquinas.map(m => m.setor).filter(Boolean))].sort();

  return { kpis, maquinas, setores, paradas };
}

/* =========================================================
   3) RELATÓRIO POR PESSOA
   ========================================================= */
export function relatorioPorPessoa(filtros){
  const paradas = filtrarParadas(filtros);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  const porTec = {};
  paradas.forEach(p => {
    const t = p.tecnicoId ? getTecnico(p.tecnicoId) : null;
    const id = p.tecnicoId || 'sem_tecnico';
    if(!porTec[id]){
      porTec[id] = {
        id,
        nome: t?.nome || 'Sem técnico',
        especialidade: t?.especialidade || '—',
        turno: t?.turno || '—',
        gestor: t?.gestor || '',
        total: 0,
        encerradas: 0,
        minutosTotal: 0,
        categorias: {}
      };
    }
    const g = porTec[id];
    g.total++;
    if(p.status === 'encerrada'){
      g.encerradas++;
      g.minutosTotal += p.duracaoMin || 0;
    }
    const cat = p.categoria || 'Sem categoria';
    g.categorias[cat] = (g.categorias[cat] || 0) + 1;
  });

  const pessoas = Object.values(porTec)
    .filter(p => p.id !== 'sem_tecnico')
    .map(p => ({
      ...p,
      mttr: p.encerradas > 0
        ? Math.round(p.minutosTotal / p.encerradas)
        : null
    }))
    .sort((a,b) => b.total - a.total);

  const kpis = {
    totalPessoas:    pessoas.length,
    totalParadas:    paradas.length,
    pessoaTop:       pessoas[0]?.nome || '—',
    mttrMedio:       encerradas.length
      ? Math.round(encerradas.reduce((s,p) => s + (p.duracaoMin || 0), 0) / encerradas.length)
      : null
  };

  return { kpis, pessoas, paradas };
}

export { DOW };