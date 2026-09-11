import { escapeHtml } from '../core/utils.js';

export function optionsFrom(arr, selected){
  return arr.map(o => `<option ${selected === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
}

export function datalist(id, valores){
  return `<datalist id="${id}">${valores.map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
}