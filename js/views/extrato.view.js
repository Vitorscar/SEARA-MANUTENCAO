import { state, getMaquina, getTecnico } from '../core/state.js';
import { abrirDetalheParada } from '../ui/parada-detail.js';
import { fmtDuracaoMin, escapeHtml } from '../core/utils.js';

let filtros = {
  busca: '',
  periodo: '30d',
  maquinaId: '',
  tecnicoId: '',
  categoria: ''
};

const DIAS = { '7d':7, '30d':30, '90d':90, 'all':99999 };

export function renderExtrato(){
  const hoje = new Date().toISOString().slice(0,10);
  const limite = Date.now() - (DIAS[filtros.periodo] || 30) * 86400000;

  const lista = state.db.paradas.filter(p => {
    if(p.status !== 'encerrada') return false;
    if(p.horaInicio < limite) return false;
    if(filtros.maquinaId && p.maquinaId !== filtros.maquinaId) return false;
    if(filtros.tecnicoId && p.tecnicoId !== filtros.tecnicoId) return false;
    if(filtros.categoria && p.categoria !== filtros.categoria) return false;
    if(filtros.busca){
      const q = filtros.busca.toLowerCase();
      const m = getMaquina(p.maquinaId);
      const hay = [m?.nome, p.setor, p.causaRaiz, p.componente, p.categoria, p.subcausa]
        .filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  }).sort((a,b) => b.horaInicio - a.horaInicio);

  return `
    <div class="extrato-bar">
      <input type="search" id="exBusca" class="input-mini" placeholder="🔍 Buscar máquina, causa, componente…" value="${escapeHtml(filtros.busca)}">

      <select class="input-mini" id="exPeriodo">
        <option value="7d"  ${filtros.periodo==='7d'?'selected':''}>7 dias</option>
        <option value="30d" ${filtros.periodo==='30d'?'selected':''}>30 dias</option>
        <option value="90d" ${filtros.periodo==='90d'?'selected':''}>90 dias</option>
        <option value="all" ${filtros.periodo==='all'?'selected':''}>Tudo</option>
      </select>

      <select class="input-mini" id="exMaquina">
        <option value="">Máquina: todas</option>
        ${state.db.maquinas.map(m =>
          `<option value="${m.id}" ${filtros.maquinaId===m.id?'selected':''}>${escapeHtml(m.nome)}</option>`
        ).join('')}
      </select>

      <select class="input-mini" id="exTecnico">
        <option value="">Técnico: todos</option>
        ${state.db.tecnicos.map(t =>
          `<option value="${t.id}" ${filtros.tecnicoId===t.id?'selected':''}>${escapeHtml(t.nome)}</option>`
        ).join('')}
      </select>

      <button class="btn sm ghost" id="exLimpar">Limpar</button>
    </div>

    <div class="extrato-info">
      <b>${lista.length}</b> parada${lista.length !== 1 ? 's' : ''} no período
    </div>

    <div class="extrato-lista" id="extratoLista">
      ${lista.length === 0
        ? `<div class="empty">Nenhuma parada encontrada com esses filtros.</div>`
        : lista.map(extratoCardHTML).join('')
      }
    </div>
  `;
}

function extratoCardHTML(p){
  const m = getMaquina(p.maquinaId);
  const t = p.tecnicoId ? getTecnico(p.tecnicoId) : null;
  const anexos = p.anexos || [];
  const temFoto  = anexos.some(a => a.tipo === 'foto');
  const temAudio = anexos.some(a => a.tipo === 'audio');
  const temVideo = anexos.some(a => a.tipo === 'video');
  const data = new Date(p.horaInicio).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
  const hora = new Date(p.horaInicio).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

  return `
    <button class="ex-card" onclick="abrirDetalheParada(window.state.db.paradas.find(x => x.id === '${p.id}'))">
      <div class="ex-card-head">
        <div class="ex-card-title">
          <b>#${p.numero}</b>
          <span>·</span>
          <span class="ex-maq">${escapeHtml(m?.nome || '—')}</span>
        </div>
        <div class="ex-card-date">${data} ${hora}</div>
      </div>

      <div class="ex-card-desc">
        ${escapeHtml(p.causaRaiz || p.descricao || p.categoria || 'Sem descrição')}
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

/* Wire dos filtros — chamado depois que o HTML é injetado */
export function wireExtrato(){
  const update = (key, val) => { filtros[key] = val; redrawExtrato(); };

  document.getElementById('exBusca')?.addEventListener('input', e => update('busca', e.target.value));
  document.getElementById('exPeriodo')?.addEventListener('change', e => update('periodo', e.target.value));
  document.getElementById('exMaquina')?.addEventListener('change', e => update('maquinaId', e.target.value));
  document.getElementById('exTecnico')?.addEventListener('change', e => update('tecnicoId', e.target.value));

  document.getElementById('exLimpar')?.addEventListener('click', () => {
    filtros = { busca:'', periodo:'30d', maquinaId:'', tecnicoId:'', categoria:'' };
    redrawExtrato();
  });
}

function redrawExtrato(){
  const cont = document.getElementById('extratoContent');
  if(!cont) return;
  cont.innerHTML = renderExtrato();
  wireExtrato();
}