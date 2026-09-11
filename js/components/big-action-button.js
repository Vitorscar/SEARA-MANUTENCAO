import { ICONS } from '../ui/icons.js';

export function bigButton({ classe, icone, titulo, sub, contador, acao }){
  const cnt = contador !== undefined ? `<span class="cnt">${contador}</span>` : '';
  return `
    <button class="big-btn ${classe}" onclick="${acao}">
      <div class="left">
        <div class="icon-box">${icone}</div>
        <div class="txt">${titulo}<small>${sub}</small></div>
      </div>
      ${cnt}
    </button>
  `;
}