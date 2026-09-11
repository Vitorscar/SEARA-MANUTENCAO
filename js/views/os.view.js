import { state } from '../core/state.js';
import { kanbanCardHTML } from '../components/kanban-card.js';
import { moverOS } from '../services/os.service.js';
import { COLUNAS } from '../data/constants.js';
import { renderExtrato, wireExtrato } from './extrato.view.js';

let abaAtiva = 'quadro'; // 'quadro' | 'extrato'

export function renderOS() {
  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Ordens de serviço</h2>
      <div class="tabs">
        <button class="tab ${abaAtiva === 'quadro'  ? 'active' : ''}" data-tab="quadro">📋 Quadro</button>
        <button class="tab ${abaAtiva === 'extrato' ? 'active' : ''}" data-tab="extrato">📜 Extrato</button>
      </div>
    </div>
    <div id="osContent"></div>
  `;

  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      abaAtiva = t.dataset.tab;
      renderOS();
    };
  });

  const cont = document.getElementById('osContent');
  
  if (abaAtiva === 'extrato') {
    cont.innerHTML = renderExtrato();
    wireExtrato();
    return;
  }

  /* Kanban */
  cont.innerHTML = `<div class="kanban" id="kanban"></div>`;
  const kanban = document.getElementById('kanban');
  
  kanban.innerHTML = COLUNAS.map(c => {
    const items = state.db.os.filter(o => o.coluna === c.id);
    return `
      <div class="kcol" data-col="${c.id}">
        <h3><span>${c.nome}</span><span>${items.length}</span></h3>
        ${items.map(o => kanbanCardHTML(o)).join('') || '<div class="empty" style="padding:14px; font-size:12px;">vazio</div>'}
      </div>
    `;
  }).join('');

  kanban.querySelectorAll('.kcard').forEach(card => {
    card.addEventListener('dragstart', e => {
      state.draggedOSId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  kanban.querySelectorAll('.kcol').forEach(col => {
    col.addEventListener('dragover', e => { 
      e.preventDefault(); 
      col.classList.add('dragover'); 
    });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('dragover');
      moverOS(state.draggedOSId, col.dataset.col);
      window.__render?.();
    });
  });
}