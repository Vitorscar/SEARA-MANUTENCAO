import { getMaquina, getTecnico } from '../core/state.js';
import { escapeHtml } from '../core/utils.js';

export function kanbanCardHTML(os){
  const m = getMaquina(os.maquinaId);
  const t = os.tecnicoId ? getTecnico(os.tecnicoId) : null;
  const cls = os.coluna === 'andamento' ? 'sun'
            : os.coluna === 'concluido' ? 'done' : '';
  return `
    <div class="kcard ${cls}" draggable="true" data-id="${os.id}">
      <div class="num">#${os.id.slice(-4)}</div>
      <div class="title">${escapeHtml(os.titulo)}</div>
      <div class="sub">${m ? escapeHtml(m.nome) : ''}${t ? ' · ' + escapeHtml(t.nome) : ''}</div>
    </div>
  `;
}