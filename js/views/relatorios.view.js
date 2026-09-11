import { state } from '../core/state.js';
import { toast } from '../ui/toast.js';
import { getRelatorio, DOW_LABELS } from '../services/relatorios.service.js';
import { chartTendencia, chartPareto, chartHeatmap,
         chartRanking, chartPorHora, chartDonut } from '../ui/charts.js';
import { fmtDuracaoMin, escapeHtml } from '../core/utils.js';
import { TURNOS } from '../data/constants.js';
import { optionsFrom } from '../components/form-fields.js';

export function renderRelatorios(){
  const f = state.filtros.relatorios;
  const r = getRelatorio(f);
  const k = r.kpis;

  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Relatórios · Indicadores</h2>
      <button class="btn sm ghost" onclick="exportarCSV()">⬇️ CSV</button>
    </div>

    <!-- ============ Filtros ============ -->
    <div class="filtros-bar">
      <select class="input-mini" id="fPeriodo">
        <option value="7d"  ${f.periodo==='7d'?'selected':''}>Últimos 7 dias</option>
        <option value="30d" ${f.periodo==='30d'?'selected':''}>Últimos 30 dias</option>
        <option value="90d" ${f.periodo==='90d'?'selected':''}>Últimos 90 dias</option>
        <option value="all" ${f.periodo==='all'?'selected':''}>Todo o período</option>
      </select>

      <select class="input-mini" id="fTecnico">
        <option value="">Funcionário: todos</option>
        ${state.db.tecnicos.map(t =>
          `<option value="${t.id}" ${f.tecnicoId===t.id?'selected':''}>${escapeHtml(t.nome)}</option>`
        ).join('')}
      </select>

      <select class="input-mini" id="fMaquina">
        <option value="">Máquina: todas</option>
        ${state.db.maquinas.map(m =>
          `<option value="${m.id}" ${f.maquinaId===m.id?'selected':''}>${escapeHtml(m.nome)}</option>`
        ).join('')}
      </select>

      <select class="input-mini" id="fTurno">
        <option value="">Turno: todos</option>
        ${optionsFrom(TURNOS, f.turno)}
      </select>

      <button class="btn sm ghost" onclick="limparFiltrosRelatorios()">Limpar</button>
    </div>

    <!-- ============ Faixa de KPIs ============ -->
    <div class="kpi-strip">
      <div class="kpi-card blue">
        <b>${k.total}</b><span>Paradas</span>
        <small>no período</small>
      </div>
      <div class="kpi-card">
        <b>${k.mttr ? k.mttr + 'min' : '—'}</b><span>MTTR</span>
        <small>tempo de reparo</small>
      </div>
      <div class="kpi-card sun">
        <b>${k.mtbf ? Math.round(k.mtbf/60) + 'h' : '—'}</b><span>MTBF</span>
        <small>entre falhas</small>
      </div>
      <div class="kpi-card green">
        <b>${k.disponibilidade}%</b><span>Disponib.</span>
        <small>no período</small>
      </div>
      <div class="kpi-card amber">
        <b>${k.mttResposta ? k.mttResposta + 'min' : '—'}</b><span>Resposta</span>
        <small>até assumir</small>
      </div>
      <div class="kpi-card gray">
        <b>${fmtDuracaoMin(k.totalMin)}</b><span>Tempo perdido</span>
        <small>soma total</small>
      </div>
    </div>

    <!-- ============ Grid de gráficos ============ -->
    <div class="charts-grid">

      <!-- 1) Tendência (2/3 largura) -->
      <div class="chart-card wide">
        <div class="chart-card-head">
          <div class="chart-card-title">Tendência — últimos 14 dias</div>
          <div class="chart-card-sub">Volume × MTTR</div>
        </div>
        ${chartTendencia({ data: r.tendencia })}
      </div>

      <!-- 2) Pareto (2/3) -->
      <div class="chart-card wide">
        <div class="chart-card-head">
          <div class="chart-card-title">Pareto de causas</div>
          <div class="chart-card-sub">As 20% causas que geram 80% do tempo perdido</div>
        </div>
        ${chartPareto({ data: r.pareto })}
      </div>

      <!-- 3) Heatmap -->
      <div class="chart-card">
        <div class="chart-card-head">
          <div class="chart-card-title">Concentração Turno × Dia</div>
          <div class="chart-card-sub">Onde alocar técnicos?</div>
        </div>
        ${chartHeatmap(r.heatmap, DOW_LABELS)}
      </div>

      <!-- 4) Donut por categoria -->
      <div class="chart-card">
        <div class="chart-card-head">
          <div class="chart-card-title">Tempo por categoria</div>
          <div class="chart-card-sub">Onde o tempo é consumido</div>
        </div>
        ${chartDonut({ data: r.categorias })}
      </div>

      <!-- 5) Top máquinas -->
      <div class="chart-card">
        <div class="chart-card-head">
          <div class="chart-card-title">Top 5 máquinas</div>
          <div class="chart-card-sub">Por tempo total parado</div>
        </div>
        ${chartRanking({
          data: r.topMaquinas.map(m => ({
            label: m.nome,
            value: m.minutos,
            display: fmtDuracaoMin(m.minutos),
            sub: `${m.count} parada${m.count > 1 ? 's' : ''}`
          })),
          cor: 'var(--red)'
        })}
      </div>

      <!-- 6) Top técnicos -->
      <div class="chart-card">
        <div class="chart-card-head">
          <div class="chart-card-title">Top 5 técnicos</div>
          <div class="chart-card-sub">Volume + MTTR individual</div>
        </div>
        ${chartRanking({
          data: r.topTecnicos.map(t => ({
            label: t.nome,
            value: t.count,
            display: `${t.count} parada${t.count > 1 ? 's' : ''}`,
            sub: `MTTR ${t.mttr}min`
          })),
          cor: 'var(--sun-dark)'
        })}
      </div>

      <!-- 7) Distribuição horária (largura total) -->
      <div class="chart-card wide">
        <div class="chart-card-head">
          <div class="chart-card-title">Distribuição por hora do dia</div>
          <div class="chart-card-sub">Picos de falha por horário</div>
        </div>
        ${chartPorHora({ data: r.porHora })}
      </div>

    </div>
  `;

  document.getElementById('fPeriodo').onchange = e => { f.periodo = e.target.value; renderRelatorios(); };
  document.getElementById('fTecnico').onchange = e => { f.tecnicoId = e.target.value; renderRelatorios(); };
  document.getElementById('fMaquina').onchange = e => { f.maquinaId = e.target.value; renderRelatorios(); };
  document.getElementById('fTurno').onchange   = e => { f.turno = e.target.value; renderRelatorios(); };
}

export function limparFiltrosRelatorios(){
  state.filtros.relatorios = { periodo:'30d', tecnicoId:'', maquinaId:'', turno:'', categoria:'' };
  renderRelatorios();
}

export function exportarCSV(){
  const f = state.filtros.relatorios;
  const encerradas = state.db.paradas.filter(p => p.status === 'encerrada').filter(p => {
    if(f.tecnicoId && p.tecnicoId !== f.tecnicoId) return false;
    if(f.maquinaId && p.maquinaId !== f.maquinaId) return false;
    if(f.turno && p.turno !== f.turno) return false;
    return true;
  });
  if(encerradas.length === 0){ toast('Nada para exportar.', 'red'); return; }

  const headers = ['Data','Nº','Máquina','Setor','Turno','Duração (min)','Impacto','Categoria','Subcausa','Componente','Causa Raiz','Ação','Preventiva','Responsável','Observação'];
  const rows = encerradas.map(p => [
    new Date(p.horaInicio).toLocaleDateString('pt-BR'),
    p.numero, state.db.maquinas.find(m=>m.id===p.maquinaId)?.nome || '',
    p.setor, p.turno, p.duracaoMin || '',
    p.impacto, p.categoria, p.subcausa, p.componente, p.causaRaiz,
    p.acaoComponente, p.acaoPreventiva, p.responsavel, p.observacao
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paradas_seara_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado', 'green');
}