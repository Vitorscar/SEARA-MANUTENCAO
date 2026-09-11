import { state, getMaquina, getTecnico } from '../core/state.js';
import { fmtMin, escapeHtml, impactoCor, minutosDesde } from '../core/utils.js';

export function nivel(p){
  const m = minutosDesde(p.horaInicio);
  if(m >= 60) return 'crit';
  if(m >= 30) return 'warn';
  return 'ok';
}

export function paradaCardHTML(p){
  const m = getMaquina(p.maquinaId);
  const t = p.tecnicoId ? getTecnico(p.tecnicoId) : null;
  const niv = nivel(p);
  const cls = p.status === 'atendendo' ? 'atendendo'
            : niv === 'crit' ? 'crit'
            : niv === 'warn' ? 'warn' : '';
  const statusLbl = p.status === 'atendendo'
    ? `<b>Em atendimento${t ? ' · ' + escapeHtml(t.nome) : ''}</b>`
    : '<b>Aguardando técnico</b>';

  return `
    <div class="card ${cls}">
      <div class="top">
        <div style="display:flex; gap:10px; align-items:flex-start; min-width:0; flex:1;">
          ${p.foto ? `<img class="thumb" src="${p.foto}" alt="">` : ''}
          <div style="min-width:0;">
            <div class="title">#${p.numero} · ${escapeHtml(m?.nome || '—')}</div>
            <div class="subtitle">${escapeHtml(p.setor)} · ${escapeHtml(p.turno)} · ${escapeHtml(p.categoria || 'Sem categoria')}</div>
          </div>
        </div>
        <div class="tempo"><span class="lbl">parada há</span>${fmtMin(Date.now() - p.horaInicio)}</div>
      </div>
      <div class="meta">
        <span>${statusLbl}</span>
        <span>Impacto: <b style="color:${impactoCor(p.impacto)}">${p.impacto}</b></span>
      </div>
      <div class="actions">
        ${p.status === 'aguardando' ? `<button class="btn sm sun" data-act="atender"  data-id="${p.id}">Assumir</button>` : ''}
        <button class="btn sm primary" data-act="encerrar" data-id="${p.id}">Encerrar</button>
        <button class="btn sm ghost"   data-act="editar"   data-id="${p.id}">Corrigir</button>
      </div>
    </div>
  `;
}

export function bindParadaActions(handlers){
  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      const p = state.db.paradas.find(x => x.id === btn.dataset.id);
      if(!p) return;
      const act = btn.dataset.act;
      if(handlers[act]) handlers[act](p);
    };
  });
}