/* =========================================================
   relatorios.view.js — admin: 3 abas + busca inteligente
   Dependências: Setor→Máquina · Supervisor→Funcionário
   ========================================================= */

/* =========================================================
   Config do microserviço Python (FastAPI)
   Em dev: backend local. Em produção: URL do Railway.
   ========================================================= */
const RELATORIOS_API = {
  base: 'http://127.0.0.1:8000',
  key:  ''   // vazio enquanto o PDF_API_SECRET estiver comentado no .env
};

import { state, getMaquina, getTecnico } from '../core/state.js';
import { navigate }                      from '../core/router.js';
import { toast }                         from '../ui/toast.js';
import { escapeHtml, fmtDuracaoMin }     from '../core/utils.js';
import { abrirDetalheParada }            from '../ui/parada-detail.js';

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
  inicio:     '',
  fim:        '',
  setor:      '',
  maquinaId:  '',
  supervisor: '',
  tecnicoId:  ''
};

/* =========================================================
   HELPERS — busca inteligente
   ========================================================= */

/* Normaliza string (case-insensitive + sem acento) */
function normalizar(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/* Retorna os itens ordenados alfabeticamente (pt-BR) */
function ordenar(arr, chave){
  return [...arr].sort((a,b) =>
    String(a[chave] || '').localeCompare(String(b[chave] || ''), 'pt-BR')
  );
}

/* Setores únicos (ordem crescente) */
function setoresUnicos(){
  return [...new Set((state.db?.maquinas || [])
    .map(m => m.setor)
    .filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'pt-BR'));
}

/* Máquinas do setor (ou todas) — ordem crescente */
function maquinasDoSetor(setor){
  return ordenar(
    (state.db?.maquinas || []).filter(m => !setor || m.setor === setor),
    'nome'
  );
}

/* Supervisores/gestores únicos (ordem crescente) */
function supervisoresUnicos(){
  return [...new Set((state.db?.tecnicos || [])
    .map(t => t.gestor)
    .filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'pt-BR'));
}

/* Técnicos de um supervisor (ou todos) — ordem crescente */
function tecnicosDoSupervisor(supervisor){
  return ordenar(
    (state.db?.tecnicos || []).filter(t => !supervisor || t.gestor === supervisor),
    'nome'
  );
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

      <!-- Filtros (variam por aba) -->
      <div class="rel-filtros" id="rel-filtros">
        ${htmlFiltros()}
      </div>

      <!-- Conteúdo -->
      <div id="rel-conteudo"></div>
    </div>
  `;

  wireTabs();
  wireFiltros();
  renderConteudo();
}

/* =========================================================
   FILTROS POR ABA
   ========================================================= */
function htmlFiltros(){
  const campoDataInicio = `
    <div class="rel-filtro">
      <label>Data início</label>
      <input type="date" id="rel-inicio" value="${filtros.inicio}">
    </div>
  `;
  const campoDataFim = `
    <div class="rel-filtro">
      <label>Data fim</label>
      <input type="date" id="rel-fim" value="${filtros.fim}">
    </div>
  `;
  const btnAplicar = `<button type="button" class="btn sm primary rel-aplicar" id="rel-aplicar">Filtrar</button>`;
  const btnLimpar  = `<button type="button" class="btn sm ghost rel-limpar" id="rel-limpar">Limpar</button>`;

  /* ---------- ABA GERAL ---------- */
  if(abaAtiva === 'geral'){
    return campoDataInicio + campoDataFim + btnAplicar + btnLimpar;
  }

  /* ---------- ABA MÁQUINAS ---------- */
  if(abaAtiva === 'maquina'){
    const setores  = setoresUnicos().map(s => ({ id: s, label: s }));
    const maquinas = maquinasDoSetor(filtros.setor).map(m => ({ id: m.id, label: m.nome }));

    const textoMaq = filtros.maquinaId
      ? (getMaquina(filtros.maquinaId)?.nome || '')
      : '';

    return `
      ${renderSearchField({
        id: 'rel-setor',
        label: 'Setor',
        placeholder: 'Digite o setor…',
        items: setores,
        valueText: filtros.setor,
        selectedId: filtros.setor
      })}
      ${renderSearchField({
        id: 'rel-maquina',
        label: 'Máquina',
        placeholder: 'Digite a máquina…',
        items: maquinas,
        valueText: textoMaq,
        selectedId: filtros.maquinaId
      })}
      ${campoDataInicio}
      ${campoDataFim}
      ${btnAplicar}
      ${btnLimpar}
    `;
  }

  /* ---------- ABA EQUIPE ---------- */
  if(abaAtiva === 'pessoa'){
    const supervisores = supervisoresUnicos().map(s => ({ id: s, label: s }));
    const funcionarios = tecnicosDoSupervisor(filtros.supervisor).map(t => ({ id: t.id, label: t.nome }));

    const textoFunc = filtros.tecnicoId
      ? (getTecnico(filtros.tecnicoId)?.nome || '')
      : '';

    return `
      ${renderSearchField({
        id: 'rel-supervisor',
        label: 'Supervisor',
        placeholder: 'Digite o supervisor…',
        items: supervisores,
        valueText: filtros.supervisor,
        selectedId: filtros.supervisor
      })}
      ${renderSearchField({
        id: 'rel-funcionario',
        label: 'Funcionário',
        placeholder: 'Digite o funcionário…',
        items: funcionarios,
        valueText: textoFunc,
        selectedId: filtros.tecnicoId
      })}
      ${campoDataInicio}
      ${campoDataFim}
      ${btnAplicar}
      ${btnLimpar}
    `;
  }
}

/* Campo de busca inteligente (input + datalist) */
function renderSearchField({ id, label, placeholder, items, valueText = '', selectedId = '' }){
  const listId = id + '-list';

  return `
    <div class="rel-filtro">
      <label>${escapeHtml(label)}</label>
      <input type="text"
             id="${id}"
             class="input-mini"
             list="${listId}"
             placeholder="${escapeHtml(placeholder)}"
             value="${escapeHtml(valueText)}"
             data-id="${escapeHtml(selectedId)}"
             autocomplete="off"
             autocapitalize="off"
             autocorrect="off"
             spellcheck="false">
      <datalist id="${listId}">
        ${items.map(it =>
          `<option value="${escapeHtml(it.label)}"></option>`
        ).join('')}
      </datalist>
    </div>
  `;
}

/* =========================================================
   WIRING — ABAS
   ========================================================= */
function wireTabs(){
  document.querySelectorAll('.rel-tab').forEach(t => {
    t.onclick = () => {
      abaAtiva = t.dataset.aba;

      /* Limpa filtros da aba que saiu */
      if(abaAtiva !== 'maquina'){
        filtros.setor     = '';
        filtros.maquinaId = '';
      }
      if(abaAtiva !== 'pessoa'){
        filtros.supervisor = '';
        filtros.tecnicoId  = '';
      }

      renderRelatorios();
    };
  });
}

/* =========================================================
   WIRING — FILTROS
   ========================================================= */
function wireFiltros(){
  /* ----- Datas ----- */
  document.getElementById('rel-inicio')?.addEventListener('change', e => {
    filtros.inicio = e.target.value;
  });
  document.getElementById('rel-fim')?.addEventListener('change', e => {
    filtros.fim = e.target.value;
  });

  /* ----- Setor ----- */
  document.getElementById('rel-setor')?.addEventListener('change', onSetorChange);

  /* ----- Máquina ----- */
  document.getElementById('rel-maquina')?.addEventListener('change', onMaquinaChange);

  /* ----- Supervisor ----- */
  document.getElementById('rel-supervisor')?.addEventListener('change', onSupervisorChange);

  /* ----- Funcionário ----- */
  document.getElementById('rel-funcionario')?.addEventListener('change', onFuncionarioChange);

  /* ----- Botões ----- */
  document.getElementById('rel-aplicar')?.addEventListener('click', renderConteudo);
  document.getElementById('rel-limpar')?.addEventListener('click', limparFiltros);
  document.getElementById('rel-exportar')?.addEventListener('click', exportarExcel);
}

/* ----- Handlers com filtro dependente ----- */

function onSetorChange(){
  const input   = document.getElementById('rel-setor');
  const texto   = input.value.trim();
  const setores = setoresUnicos().map(s => ({ id: s, label: s }));
  const match   = setores.find(s => normalizar(s.label) === normalizar(texto));

  filtros.setor = match ? match.label : '';

  /* Atualiza o datalist de máquinas ao vivo */
  const listMaq = document.getElementById('rel-maquina-list');
  if(listMaq){
    const maquinas = maquinasDoSetor(filtros.setor);
    listMaq.innerHTML = maquinas.map(m =>
      `<option value="${escapeHtml(m.nome)}"></option>`
    ).join('');
  }

  /* Limpa máquina quando o setor muda */
  const inMaq = document.getElementById('rel-maquina');
  if(inMaq){
    inMaq.value = '';
    inMaq.dataset.id = '';
  }
  filtros.maquinaId = '';
}

function onMaquinaChange(){
  const input    = document.getElementById('rel-maquina');
  const texto    = input.value.trim();
  const maquinas = maquinasDoSetor(filtros.setor);
  const match    = maquinas.find(m => normalizar(m.nome) === normalizar(texto));

  filtros.maquinaId = match ? match.id : '';
  input.dataset.id  = filtros.maquinaId;
}

function onSupervisorChange(){
  const input        = document.getElementById('rel-supervisor');
  const texto        = input.value.trim();
  const supervisores = supervisoresUnicos();
  const match        = supervisores.find(s => normalizar(s) === normalizar(texto));

  filtros.supervisor = match || '';

  /* Atualiza o datalist de funcionários ao vivo */
  const listFunc = document.getElementById('rel-funcionario-list');
  if(listFunc){
    const funcionarios = tecnicosDoSupervisor(filtros.supervisor);
    listFunc.innerHTML = funcionarios.map(t =>
      `<option value="${escapeHtml(t.nome)}"></option>`
    ).join('');
  }

  /* Limpa funcionário quando o supervisor muda */
  const inFunc = document.getElementById('rel-funcionario');
  if(inFunc){
    inFunc.value = '';
    inFunc.dataset.id = '';
  }
  filtros.tecnicoId = '';
}

function onFuncionarioChange(){
  const input        = document.getElementById('rel-funcionario');
  const texto        = input.value.trim();
  const funcionarios = tecnicosDoSupervisor(filtros.supervisor);
  const match        = funcionarios.find(t => normalizar(t.nome) === normalizar(texto));

  filtros.tecnicoId = match ? match.id : '';
  input.dataset.id  = filtros.tecnicoId;
}

function limparFiltros(){
  filtros.inicio     = '';
  filtros.fim        = '';
  filtros.setor      = '';
  filtros.maquinaId  = '';
  filtros.supervisor = '';
  filtros.tecnicoId  = '';
  renderRelatorios();
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
  /* Aplica todos os filtros ativos */
  const r = relatorioPorMaquina({
    inicio: filtros.inicio,
    fim:    filtros.fim,
    setor:  filtros.setor,
    maquinaId: filtros.maquinaId
  });

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
  const r = relatorioPorPessoa({
    inicio:    filtros.inicio,
    fim:       filtros.fim,
    tecnicoId: filtros.tecnicoId,
    supervisor: filtros.supervisor
  });

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
   WIRING — CLIQUE EM CARDS/TABELA
   ========================================================= */
function wireTabelaCliques(){
  document.querySelectorAll('.rel-tabela__row').forEach(tr => {
    tr.addEventListener('click', () => {
      abrirParadaDoRelatorio(tr.dataset.paradaId);
    });
  });
}

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
      el.addEventListener('click', () => irParaExtratoMaquina(el.dataset.maquinaId));
    }
  });
}

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
      el.addEventListener('click', () => irParaExtratoTecnico(el.dataset.tecnicoId));
    }
  });
}

/* =========================================================
   NAVEGAÇÃO PARA EXTRATO FILTRADO
   ========================================================= */
function irParaExtratoMaquina(maquinaId){
  const maq = getMaquina(maquinaId);
  if(!maq){
    toast('Máquina não encontrada', 'error');
    return;
  }

  state.filtros = state.filtros || {};
  state.filtros.extrato = {
    maquinaId,
    tecnicoId: '',
    inicio: filtros.inicio,
    fim:    filtros.fim
  };

  navigate('extrato');
}

function irParaExtratoTecnico(tecnicoId){
  const tec = getTecnico(tecnicoId);
  if(!tec){
    toast('Funcionário não encontrado', 'error');
    return;
  }

  state.filtros = state.filtros || {};
  state.filtros.extrato = {
    tecnicoId,
    maquinaId: '',
    inicio: filtros.inicio,
    fim:    filtros.fim
  };

  navigate('extrato');
}

/* Abertura de detalhe pelo ID */
function abrirParadaDoRelatorio(id){
  const p = (state.db?.paradas || []).find(x => x.id === id);
  if(!p){
    toast('Parada não encontrada', 'error');
    return;
  }
  abrirDetalheParada(p);
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

/* =========================================================
   EXPORTAR EXCEL — via microserviço Python (FastAPI)
   ========================================================= */
function exportarExcel(){
  const tipo = abaAtiva || 'geral';

  toast('Gerando planilha…', 'amber');

  const headers = { 'Content-Type': 'application/json' };
  if(RELATORIOS_API.key) headers['X-API-Key'] = RELATORIOS_API.key;

  const filtrosPayload = {
    inicio:    filtros?.inicio    || null,
    fim:       filtros?.fim       || null,
    setor:     filtros?.setor     || null,
    maquinaId: filtros?.maquinaId || null,
    tecnicoId: filtros?.tecnicoId || null
  };

  fetch(`${RELATORIOS_API.base}/excel/geral`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tipo, filtros: filtrosPayload })
  })
  .then(async res => {
    if(!res.ok){
      const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.blob();
  })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `relatorio_${tipo}_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Excel exportado com sucesso', 'success');
  })
  .catch(err => {
    console.error('[relatorios] erro Excel:', err);
    toast(err.message || 'Erro ao exportar planilha', 'error');
  });
}

/* =========================================================
   EXPOSIÇÃO GLOBAL
   ========================================================= */
Object.assign(window, {
  abrirParadaDoRelatorio,
  verFichaParadas: irParaExtratoMaquina,
  verFichaTecnico: irParaExtratoTecnico
});