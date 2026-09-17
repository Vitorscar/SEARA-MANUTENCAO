/* =========================================================
   relatorios.view.js — admin: 3 abas + filtros + drill-down
   ========================================================= */

import { state, getMaquina, getTecnico } from '../core/state.js';
import { navigate }                      from '../core/router.js';       // 🆕
import { toast }                         from '../ui/toast.js';
import { escapeHtml, fmtDuracaoMin }     from '../core/utils.js';
import { abrirDetalheParada }            from '../ui/parada-detail.js';   // 🆕

/* ⚠️ REMOVIDO: import de navegarExtratoMaquina/navegarExtratoTecnico
   (causava ciclo relatorios ↔ extrato) */

import {
  relatorioGeral,
  relatorioPorMaquina,
  relatorioPorPessoa
} from '../services/relatorios.service.js';

/* =========================================================
   ESTADO DA VIEW
   ========================================================= */
let abaAtiva = 'geral';

const filtros = {
  inicio:    '',
  fim:       '',
  setor:     '',
  tecnicoId: ''
};

/* =========================================================
   HELPERS GLOBAIS (definidos ANTES de serem usados)
   ========================================================= */

/* Abre o modal de detalhe da parada a partir do ID */
function abrirParadaDoRelatorio(id){
  const p = (state.db?.paradas || []).find(x => x.id === id);
  if(!p){
    toast('Parada não encontrada', 'error');
    return;
  }
  abrirDetalheParada(p);
}

/* Navega pro extrato filtrado por máquina */
function irParaExtratoMaquina(maquinaId){
  const maq = getMaquina(maquinaId);
  if(!maq){
    toast('Máquina não encontrada', 'error');
    return;
  }

  state.filtros = state.filtros || {};
  state.filtros.extrato = {
    ...(state.filtros.extrato || {}),
    maquinaId,
    tecnicoId: '',
    inicio: filtros.inicio,
    fim:    filtros.fim
  };

  navigate('extrato');
}

/* Navega pro extrato filtrado por técnico */
function irParaExtratoTecnico(tecnicoId){
  const tec = getTecnico(tecnicoId);
  if(!tec){
    toast('Funcionário não encontrado', 'error');
    return;
  }

  state.filtros = state.filtros || {};
  state.filtros.extrato = {
    ...(state.filtros.extrato || {}),
    tecnicoId,
    maquinaId: '',
    inicio: filtros.inicio,
    fim:    filtros.fim
  };

  navigate('extrato');
}

/* =========================================================
   RENDER
   ========================================================= */
export function renderRelatorios(){
  const viewClass =
    abaAtiva === 'maquina' ? 'rel-view--maquinas' :
    abaAtiva === 'pessoa'  ? 'rel-view--pessoas'  : '';

  document.getElementById('view').innerHTML = `
    <div class="rel-view ${viewClass}">

      <!-- Header -->
      <div class="section-head">
        <h2>Relatórios</h2>
        <button type="button" class="btn sm ghost" id="rel-exportar">⬇️ Excel</button>
      </div>

      <!-- Abas -->
      <div class="rel-tabs">
        <button type="button" class="rel-tab ${abaAtiva==='geral'?'active':''}"   data-aba="geral">
          📊 Geral
        </button>
        <button type="button" class="rel-tab ${abaAtiva==='maquina'?'active':''}" data-aba="maquina">
          ⚙️ Máquinas
        </button>
        <button type="button" class="rel-tab ${abaAtiva==='pessoa'?'active':''}"  data-aba="pessoa">
          👥 Equipe
        </button>
      </div>

      <!-- Filtros -->
      <div class="rel-filtros">
        <div class="rel-filtro">
          <label>Data início</label>
          <input type="date" id="rel-inicio" value="${filtros.inicio}">
        </div>
        <div class="rel-filtro">
          <label>Data fim</label>
          <input type="date" id="rel-fim" value="${filtros.fim}">
        </div>

        ${abaAtiva === 'maquina' ? `
          <div class="rel-filtro">
            <label>Setor</label>
            <select id="rel-setor">
              <option value="">Todos</option>
              ${setoresDoEstado().map(s =>
                `<option ${filtros.setor===s?'selected':''}>${escapeHtml(s)}</option>`
              ).join('')}
            </select>
          </div>
        ` : ''}

        ${abaAtiva === 'pessoa' ? `
          <div class="rel-filtro">
            <label>Funcionário</label>
            <select id="rel-tecnico">
              <option value="">Todos</option>
              ${(state.db?.tecnicos || []).map(t =>
                `<option value="${t.id}" ${filtros.tecnicoId===t.id?'selected':''}>
                  ${escapeHtml(t.nome)}
                </option>`
              ).join('')}
            </select>
          </div>
        ` : ''}

        <button type="button" class="btn sm primary rel-aplicar" id="rel-aplicar">Filtrar</button>
        <button type="button" class="btn sm ghost rel-limpar"    id="rel-limpar">Limpar</button>
      </div>

      <!-- Conteúdo (preenchido por aba) -->
      <div id="rel-conteudo"></div>
    </div>
  `;

  wireTabs();
  wireFiltros();
  renderConteudo();
}

/* =========================================================
   WIRING
   ========================================================= */
function wireTabs(){
  document.querySelectorAll('.rel-tab').forEach(t => {
    t.onclick = () => {
      abaAtiva = t.dataset.aba;

      if(abaAtiva !== 'maquina') filtros.setor     = '';
      if(abaAtiva !== 'pessoa')  filtros.tecnicoId = '';

      renderRelatorios();
    };
  });
}

function wireFiltros(){
  document.getElementById('rel-aplicar').onclick = () => {
    filtros.inicio = document.getElementById('rel-inicio').value;
    filtros.fim    = document.getElementById('rel-fim').value;

    const selSetor = document.getElementById('rel-setor');
    if(selSetor) filtros.setor = selSetor.value;

    const selTec = document.getElementById('rel-tecnico');
    if(selTec) filtros.tecnicoId = selTec.value;

    renderConteudo();
  };

  document.getElementById('rel-limpar').onclick = () => {
    filtros.inicio    = '';
    filtros.fim       = '';
    filtros.setor     = '';
    filtros.tecnicoId = '';
    renderRelatorios();
  };

  document.getElementById('rel-exportar').onclick = exportarExcel;
}

/* =========================================================
   CONTEÚDO POR ABA
   ========================================================= */
function renderConteudo(){
  const cont = document.getElementById('rel-conteudo');
  if(!cont) return;

  switch(abaAtiva){
    case 'geral':   cont.innerHTML = htmlGeral();   break;
    case 'maquina': cont.innerHTML = htmlMaquina(); break;
    case 'pessoa':  cont.innerHTML = htmlPessoa();  break;
  }

  if(abaAtiva === 'geral')   wireTabelaCliques();
  if(abaAtiva === 'maquina') wireCardsMaquina();
  if(abaAtiva === 'pessoa')  wireCardsPessoa();
}

/* =========================================================
   ABA: GERAL
   ========================================================= */
function htmlGeral(){
  const r = relatorioGeral(filtros);
  const k = r.kpis;

  return `
    <div class="rel-kpis">
      ${kpiCard('Total',         k.total,            'paradas')}
      ${kpiCard('Encerradas',    k.encerradas,       'concluídas')}
      ${kpiCard('Abertas',       k.abertas,          'em andamento')}
      ${kpiCard('Críticas',      k.criticas,         'impacto alto')}
      ${kpiCard('MTTR',          k.mttr ? k.mttr + 'min' : '—', 'tempo médio')}
      ${kpiCard('Tempo perdido', fmtDuracaoMin(k.tempoTotalMin), 'total')}
    </div>

    <div class="rel-chart">
      <div class="rel-chart__title">Paradas por dia</div>
      ${renderBarras(r.tendencia)}
    </div>

    <div class="rel-chart">
      <div class="rel-chart__title">Top causas (tempo perdido)</div>
      ${r.pareto.length === 0
        ? '<div class="rel-empty">Sem dados no período.</div>'
        : r.pareto.map(p => `
            <div class="rel-pareto">
              <div class="rel-pareto__lbl">${escapeHtml(p.label)}</div>
              <div class="rel-pareto__track">
                <div class="rel-pareto__fill" style="width:${p.pct}%"></div>
              </div>
              <div class="rel-pareto__val">${p.minutos}min</div>
            </div>
          `).join('')
      }
    </div>

    <div class="rel-chart">
      <div class="rel-chart__title">Top máquinas (tempo parado)</div>
      ${r.topMaquinas.length === 0
        ? '<div class="rel-empty">Sem dados no período.</div>'
        : r.topMaquinas.map((m, i) => `
            <div class="rel-rank">
              <span class="rel-rank__nome">${i+1}. ${escapeHtml(m.nome)}</span>
              <span class="rel-rank__val">
                ${fmtDuracaoMin(m.minutos)} <small>(${m.count})</small>
              </span>
            </div>
          `).join('')
      }
    </div>

    <div class="rel-tabela-wrap">
      <table class="rel-tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Máquina</th>
            <th>Duração</th>
            <th>Falha</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${r.paradas.length === 0
            ? `<tr><td colspan="6" class="rel-tabela__empty">Sem dados no período.</td></tr>`
            : r.paradas.slice(0, 50).map(p => {
                const m = getMaquina(p.maquinaId);
                return `
                  <tr class="rel-tabela__row" data-parada-id="${p.id}">
                    <td>${formatarData(p.horaInicio)}</td>
                    <td>${escapeHtml(m?.nome || '—')}</td>
                    <td>${p.duracaoMin ? p.duracaoMin + 'min' : '—'}</td>
                    <td>${escapeHtml(p.categoria || '—')}</td>
                    <td>${labelStatus(p.status)}</td>
                    <td class="rel-tabela__acao">
                      <span class="rel-tabela__chev">›</span>
                    </td>
                  </tr>
                `;
              }).join('')
          }
        </tbody>
      </table>
    </div>
  `;
}

/* =========================================================
   ABA: MÁQUINAS
   ========================================================= */
function htmlMaquina(){
  const r = relatorioPorMaquina(filtros);
  const k = r.kpis;

  return `
    <div class="rel-kpis">
      ${kpiCard('Máquinas',     k.maquinasAfetadas, 'com parada')}
      ${kpiCard('Total',        k.totalParadas,     'paradas')}
      ${kpiCard('Top',          truncar(k.maquinaTop, 12), 'mais parada')}
      ${kpiCard('Tempo total',  fmtDuracaoMin(k.tempoTotalMin), 'parado')}
    </div>

    ${r.maquinas.length === 0
      ? '<div class="rel-empty">Sem máquinas com parada no período.</div>'
      : r.maquinas.map(m => `
          <div class="rel-maq-card" data-maquina-id="${m.id}">
            <div class="rel-maq-head">
              <div>
                <div class="rel-maq-nome">${escapeHtml(m.nome)}</div>
                <div class="rel-maq-sub">
                  ${escapeHtml(m.setor)}${m.area ? ' · ' + escapeHtml(m.area) : ''}
                </div>
              </div>
              <div class="rel-maq-badge">${m.total}</div>
            </div>

            <div class="rel-maq-stats">
              <span><b>${m.encerradas}</b> encerradas</span>
              <span><b>${m.abertas}</b> abertas</span>
              <span><b>${fmtDuracaoMin(m.minutosTotal)}</b> parado</span>
            </div>

            <div class="rel-maq-cats">
              ${Object.entries(m.categorias)
                .sort((a,b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, cnt]) => `<span class="rel-tag">${escapeHtml(cat)} · ${cnt}</span>`)
                .join('')
              }
            </div>

            <div class="rel-maq-actions">
              <button type="button" class="rel-btn-ficha"
                      data-maquina-id="${m.id}">
                📄 Ver todas as paradas
              </button>
            </div>
          </div>
        `).join('')
    }
  `;
}

/* =========================================================
   ABA: EQUIPE
   ========================================================= */
function htmlPessoa(){
  const r = relatorioPorPessoa(filtros);
  const k = r.kpis;

  return `
    <div class="rel-kpis">
      ${kpiCard('Pessoas',  k.totalPessoas, 'com registro')}
      ${kpiCard('Total',    k.totalParadas, 'paradas')}
      ${kpiCard('Top',      truncar(k.pessoaTop, 12), 'mais paradas')}
      ${kpiCard('MTTR',     k.mttrMedio ? k.mttrMedio + 'min' : '—', 'médio')}
    </div>

    ${r.pessoas.length === 0
      ? '<div class="rel-empty">Sem dados no período.</div>'
      : r.pessoas.map(p => `
          <div class="rel-maq-card" data-tecnico-id="${p.id}">
            <div class="rel-maq-head">
              <div>
                <div class="rel-maq-nome">${escapeHtml(p.nome)}</div>
                <div class="rel-maq-sub">
  ${escapeHtml(p.especialidade)} · ${escapeHtml(p.turno)}
</div>
<div class="rel-maq-gestor">
  👤 Gestor: <b>${escapeHtml(p.gestor || 'Não informado')}</b>
</div>
              </div>
              <div class="rel-maq-badge">${p.total}</div>
            </div>

            <div class="rel-maq-stats">
              <span><b>${p.encerradas}</b> encerradas</span>
              <span><b>${fmtDuracaoMin(p.minutosTotal)}</b> tempo</span>
              <span>MTTR <b>${p.mttr ? p.mttr + 'min' : '—'}</b></span>
            </div>

            <div class="rel-maq-cats">
              ${Object.entries(p.categorias)
                .sort((a,b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, cnt]) => `<span class="rel-tag">${escapeHtml(cat)} · ${cnt}</span>`)
                .join('')
              }
            </div>

            <div class="rel-maq-actions">
              <button type="button" class="rel-btn-ficha"
                      data-tecnico-id="${p.id}">
                📄 Ver todas as paradas
              </button>
            </div>
          </div>
        `).join('')
    }
  `;
}

/* =========================================================
   WIRING — CLIQUE NA TABELA (GERAL)
   ========================================================= */
function wireTabelaCliques(){
  document.querySelectorAll('.rel-tabela__row').forEach(tr => {
    tr.addEventListener('click', () => {
      abrirParadaDoRelatorio(tr.dataset.paradaId);   // ← agora a função existe
    });
  });
}

/* =========================================================
   WIRING — CARDS DE MÁQUINA
   ========================================================= */
function wireCardsMaquina(){
  document.querySelectorAll('[data-maquina-id]').forEach(el => {
    if(el.classList.contains('rel-btn-ficha')){
      el.addEventListener('click', e => {
        e.stopPropagation();
        irParaExtratoMaquina(el.dataset.maquinaId);
      });
      return;
    }

    if(el.classList.contains('rel-maq-card')){
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        irParaExtratoMaquina(el.dataset.maquinaId);
      });
    }
  });
}

/* =========================================================
   WIRING — CARDS DE TÉCNICO
   ========================================================= */
function wireCardsPessoa(){
  document.querySelectorAll('[data-tecnico-id]').forEach(el => {
    if(el.classList.contains('rel-btn-ficha')){
      el.addEventListener('click', e => {
        e.stopPropagation();
        irParaExtratoTecnico(el.dataset.tecnicoId);
      });
      return;
    }

    if(el.classList.contains('rel-maq-card')){
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        irParaExtratoTecnico(el.dataset.tecnicoId);
      });
    }
  });
}

/* =========================================================
   HELPERS DE RENDER
   ========================================================= */
function kpiCard(label, valor, sub){
  return `
    <div class="rel-kpi">
      <div class="rel-kpi__val">${valor}</div>
      <div class="rel-kpi__lbl">${label}</div>
      ${sub ? `<div class="rel-kpi__sub">${sub}</div>` : ''}
    </div>
  `;
}

function renderBarras(tendencia){
  if(!tendencia || tendencia.length === 0){
    return '<div class="rel-empty">Sem dados.</div>';
  }

  const max = Math.max(...tendencia.map(t => t.count), 1);

  return `
    <div class="rel-barras">
      ${tendencia.map(t => `
        <div class="rel-bar-col">
          <div class="rel-bar-val">${t.count}</div>
          <div class="rel-bar-track">
            <div class="rel-bar-fill" style="height:${(t.count / max) * 100}%"></div>
          </div>
          <div class="rel-bar-lbl">${escapeHtml(t.dia)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function labelStatus(s){
  return {
    aguardando: '🔴 Aguardando',
    atendendo:  '🟡 Atendendo',
    encerrada:  '🟢 Encerrada',
    cancelada:  '⚫ Cancelada'
  }[s] || s;
}

function formatarData(ts){
  if(!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'2-digit'
  });
}

function truncar(str, n){
  str = String(str || '');
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function setoresDoEstado(){
  return [...new Set((state.db?.maquinas || [])
    .map(m => m.setor)
    .filter(Boolean))]
    .sort();
}

/* =========================================================
   EXPORTAR EXCEL (CSV)
   ========================================================= */
function exportarExcel(){
  const linhas = [];
  const nome = `relatorio_${abaAtiva}_${new Date().toISOString().slice(0,10)}.csv`;

  if(abaAtiva === 'geral'){
    const r = relatorioGeral(filtros);
    linhas.push(['Data', 'Máquina', 'Setor', 'Duração (min)', 'Falha', 'Causa raiz', 'Status']);
    r.paradas.forEach(p => {
      const m = getMaquina(p.maquinaId);
      linhas.push([
        formatarData(p.horaInicio),
        m?.nome || '—',
        p.setor || '—',
        p.duracaoMin || 0,
        p.categoria || '—',
        p.causaRaizCategoria || p.subcausa || '—',
        p.status
      ]);
    });
  }

  if(abaAtiva === 'maquina'){
    const r = relatorioPorMaquina(filtros);
    linhas.push(['Máquina', 'Setor', 'Área', 'Total', 'Encerradas', 'Abertas', 'Minutos', 'Categoria mais comum']);
    r.maquinas.forEach(m => {
      const catTop = Object.entries(m.categorias)
        .sort((a,b) => b[1] - a[1])[0]?.[0] || '—';
      linhas.push([
        m.nome, m.setor, m.area || '—',
        m.total, m.encerradas, m.abertas, m.minutosTotal, catTop
      ]);
    });
  }

  if(abaAtiva === 'pessoa'){
    const r = relatorioPorPessoa(filtros);
    linhas.push(['Funcionário', 'Cargo', 'Turno', 'Gestor', 'Total', 'Encerradas', 'Minutos', 'MTTR']);
    r.pessoas.forEach(p => {
      linhas.push([
        p.nome, p.especialidade, p.turno, p.gestor || '—',
        p.total, p.encerradas, p.minutosTotal, p.mttr || '—'
      ]);
    });
  }

  if(linhas.length <= 1){
    toast('Sem dados para exportar', 'amber');
    return;
  }

  const csv = linhas
    .map(l => l.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);

  toast('Relatório exportado', 'success');
}

/* =========================================================
   EXPOSIÇÃO GLOBAL (debug + onclick inline futuro)
   ========================================================= */
Object.assign(window, {
  abrirParadaDoRelatorio,
  verFichaParadas: irParaExtratoMaquina,
  verFichaTecnico: irParaExtratoTecnico
});