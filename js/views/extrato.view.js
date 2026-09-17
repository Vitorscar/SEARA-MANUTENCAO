/* =========================================================
   extrato.view.js — histórico de paradas encerradas
   Aceita filtro pré-setado via state.filtros.extrato
   ========================================================= */

import { state, getMaquina, getTecnico } from '../core/state.js';
import { abrirDetalheParadaPorId }        from '../ui/parada-detail.js';
import { fmtDuracaoMin, escapeHtml }     from '../core/utils.js';

const DIAS = { '7d': 7, '30d': 30, '90d': 90, 'all': 99999 };

/* =========================================================
   FILTROS — estado da view
   (recarregados do state.filtros.extrato a cada render)
   ========================================================= */
let filtros = {
  busca:     '',
  periodo:   '30d',
  maquinaId: '',
  tecnicoId: '',
  categoria: ''
};

/* Aplica filtro pré-setado (vindo do relatórios) */
function aplicarFiltroExterno(){
  const ext = state.filtros?.extrato;
  if(!ext) return;

  /* Só sobrescreve o que veio preenchido */
  if(ext.maquinaId) filtros.maquinaId = ext.maquinaId;
  if(ext.tecnicoId) filtros.tecnicoId = ext.tecnicoId;
  if(ext.categoria) filtros.categoria = ext.categoria;
  if(ext.busca)     filtros.busca     = ext.busca;
  if(ext.periodo)   filtros.periodo   = ext.periodo;

  /* Limpa o flag pra não viciar */
  state.filtros.extrato = null;
}

/* =========================================================
   RENDER
   ========================================================= */
export function renderExtrato(){
  const view = document.getElementById('view');
  if(!view) return;

  /* Aplica filtros externos se houver */
  aplicarFiltroExterno();

  /* Garante db seguro */
  const paradas = state.db?.paradas || [];
  const maquinas = state.db?.maquinas || [];
  const tecnicos = state.db?.tecnicos || [];

  const limite = Date.now() - (DIAS[filtros.periodo] || 30) * 86400000;

  /* Filtra paradas encerradas */
  const lista = paradas.filter(p => {
    if(p.status !== 'encerrada') return false;
    if(p.horaInicio < limite) return false;
    if(filtros.maquinaId && p.maquinaId !== filtros.maquinaId) return false;
    if(filtros.tecnicoId && p.tecnicoId !== filtros.tecnicoId) return false;
    if(filtros.categoria && p.categoria !== filtros.categoria) return false;
    if(filtros.busca){
      const q = filtros.busca.toLowerCase();
      const m = getMaquina(p.maquinaId);
      const hay = [
        m?.nome, p.setor, p.causaRaiz, p.componente,
        p.categoria, p.causaRaizCategoria
      ].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.horaInicio - a.horaInicio);

  view.innerHTML = `
    <div class="extrato-wrap">

      <!-- Filtros -->
      <div class="extrato-bar">
        <input type="search" id="exBusca" class="input-mini"
               placeholder="🔍 Buscar máquina, causa, componente…"
               value="${escapeHtml(filtros.busca)}">

        <select class="input-mini" id="exPeriodo">
          <option value="7d"  ${filtros.periodo==='7d'?'selected':''}>7 dias</option>
          <option value="30d" ${filtros.periodo==='30d'?'selected':''}>30 dias</option>
          <option value="90d" ${filtros.periodo==='90d'?'selected':''}>90 dias</option>
          <option value="all" ${filtros.periodo==='all'?'selected':''}>Tudo</option>
        </select>

        <select class="input-mini" id="exMaquina">
          <option value="">Máquina: todas</option>
          ${maquinas.map(m =>
            `<option value="${m.id}" ${filtros.maquinaId===m.id?'selected':''}>
              ${escapeHtml(m.nome)}
            </option>`
          ).join('')}
        </select>

        <select class="input-mini" id="exTecnico">
          <option value="">Técnico: todos</option>
          ${tecnicos.map(t =>
            `<option value="${t.id}" ${filtros.tecnicoId===t.id?'selected':''}>
              ${escapeHtml(t.nome)}
            </option>`
          ).join('')}
        </select>

        <button type="button" class="btn sm ghost" id="exLimpar">Limpar</button>
      </div>

      <!-- Info -->
      <div class="extrato-info">
        <b>${lista.length}</b> parada${lista.length !== 1 ? 's' : ''} no período
      </div>

      <!-- Lista -->
      <div class="extrato-lista" id="extratoLista">
        ${lista.length === 0
          ? `<div class="empty">Nenhuma parada encontrada com esses filtros.</div>`
          : lista.map(extratoCardHTML).join('')
        }
      </div>

    </div>
  `;

  wireExtrato();
}

/* =========================================================
   CARD
   ========================================================= */
function extratoCardHTML(p){
  const m = getMaquina(p.maquinaId);
  const t = p.tecnicoId ? getTecnico(p.tecnicoId) : null;

  /* Anexos podem vir do cache local (base64) ou do storage */
  const anexos = p.anexos || [];
  const temFoto  = anexos.some(a => a.tipo === 'foto');
  const temAudio = anexos.some(a => a.tipo === 'audio');
  const temVideo = anexos.some(a => a.tipo === 'video');

  const data = new Date(p.horaInicio).toLocaleDateString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'2-digit'
  });
  const hora = new Date(p.horaInicio).toLocaleTimeString('pt-BR', {
    hour:'2-digit', minute:'2-digit'
  });

  return `
    <button type="button" class="ex-card" data-parada-id="${p.id}">
      <div class="ex-card-head">
        <div class="ex-card-title">
          <b>#${p.numero}</b>
          <span>·</span>
          <span class="ex-maq">${escapeHtml(m?.nome || '—')}</span>
        </div>
        <div class="ex-card-date">${data} ${hora}</div>
      </div>

      <div class="ex-card-desc">
        ${escapeHtml(p.causaRaiz || p.componente || p.categoria || 'Sem descrição')}
      </div>

      <div class="ex-card-foot">
        <div class="ex-tags">
          <span class="ex-tag">${escapeHtml(p.setor || '—')}</span>
          <span class="ex-tag">${escapeHtml(p.turno || '—')}</span>
          <span class="ex-tag">${fmtDuracaoMin(p.duracaoMin || 0)}</span>
        </div>
        <div class="ex-anexos">
          ${temFoto  ? `<span class="ex-anex-ic">📷</span>` : ''}
          ${temAudio ? `<span class="ex-anex-ic">🎤</span>` : ''}
          ${temVideo ? `<span class="ex-anex-ic">🎥</span>` : ''}
          ${t ? `<span class="ex-tech">${escapeHtml(t.nome.split(' ')[0])}</span>` : ''}
        </div>
      </div>
    </button>
  `;
}

/* =========================================================
   WIRING
   ========================================================= */
function wireExtrato(){
  /* Filtros */
  document.getElementById('exBusca')?.addEventListener('input', e => {
    filtros.busca = e.target.value;
    rerenderLista();
  });

  document.getElementById('exPeriodo')?.addEventListener('change', e => {
    filtros.periodo = e.target.value;
    renderExtrato();
  });

  document.getElementById('exMaquina')?.addEventListener('change', e => {
    filtros.maquinaId = e.target.value;
    renderExtrato();
  });

  document.getElementById('exTecnico')?.addEventListener('change', e => {
    filtros.tecnicoId = e.target.value;
    renderExtrato();
  });

  document.getElementById('exLimpar')?.addEventListener('click', () => {
    filtros = {
      busca:'', periodo:'30d',
      maquinaId:'', tecnicoId:'', categoria:''
    };
    renderExtrato();
  });

  /* Clique nos cards → abre detalhe */
  document.querySelectorAll('.ex-card').forEach(card => {
    card.addEventListener('click', () => {
      abrirDetalheParadaPorId(card.dataset.paradaId);
    });
  });
}

/* Re-renderiza só a lista (para busca em tempo real) */
function rerenderLista(){
  const paradas = state.db?.paradas || [];
  const limite = Date.now() - (DIAS[filtros.periodo] || 30) * 86400000;

  const lista = paradas.filter(p => {
    if(p.status !== 'encerrada') return false;
    if(p.horaInicio < limite) return false;
    if(filtros.maquinaId && p.maquinaId !== filtros.maquinaId) return false;
    if(filtros.tecnicoId && p.tecnicoId !== filtros.tecnicoId) return false;
    if(filtros.categoria && p.categoria !== filtros.categoria) return false;
    if(filtros.busca){
      const q = filtros.busca.toLowerCase();
      const m = getMaquina(p.maquinaId);
      const hay = [
        m?.nome, p.setor, p.causaRaiz, p.componente,
        p.categoria, p.causaRaizCategoria
      ].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.horaInicio - a.horaInicio);

  const cont = document.getElementById('extratoLista');
  if(!cont) return;

  cont.innerHTML = lista.length === 0
    ? `<div class="empty">Nenhuma parada encontrada com esses filtros.</div>`
    : lista.map(extratoCardHTML).join('');

  /* Rewire dos cliques */
  cont.querySelectorAll('.ex-card').forEach(card => {
    card.addEventListener('click', () => {
      abrirDetalheParadaPorId(card.dataset.paradaId);
    });
  });

  /* Atualiza contador */
  const info = document.querySelector('.extrato-info');
  if(info){
    info.innerHTML = `<b>${lista.length}</b> parada${lista.length !== 1 ? 's' : ''} no período`;
  }
}

/* =========================================================
   EXPORTS OPCIONAIS (uso em outros módulos)
   ========================================================= */
export function resetFiltrosExtrato(){
  filtros = {
    busca:'', periodo:'30d',
    maquinaId:'', tecnicoId:'', categoria:''
  };
  renderExtrato();
}