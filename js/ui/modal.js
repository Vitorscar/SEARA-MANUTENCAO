export function openModal(cor, ico, titulo, bodyHTML){
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal ativo ${cor||''}" onclick="if(event.target===this) closeModal()">
      <div class="modal-content">
        <div class="modal-header">
          <span class="ico">${ico}</span>${titulo}
          <button class="close" onclick="closeModal()">✕</button>
        </div>
        ${bodyHTML}
      </div>
    </div>
  `;
}

export function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
}