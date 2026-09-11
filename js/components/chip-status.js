export function chipStatus({ cor, valor, label }){
  return `
    <div class="chip ${cor}">
      <span class="dot ${cor}"></span>
      <div><b>${valor}</b><span class="lbl">${label}</span></div>
    </div>
  `;
}