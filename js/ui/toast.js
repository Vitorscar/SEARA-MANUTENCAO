export function toast(msg, tipo){
  const el = document.createElement('div');
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.textContent = msg;
  document.getElementById('toastwrap').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}