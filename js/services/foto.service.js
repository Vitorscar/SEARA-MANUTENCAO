import { state } from '../core/state.js';

export function processarFoto(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.draft.foto = reader.result;
    document.getElementById('photoImg').src = state.draft.foto;
    document.getElementById('photoPreview').style.display = 'inline-block';
    if(navigator.vibrate) navigator.vibrate(20);
  };
  reader.readAsDataURL(file);
}

export function removerFoto(){
  state.draft.foto = null;
  const inp = document.getElementById('fFotoInput'); if(inp) inp.value = '';
  const prev = document.getElementById('photoPreview'); if(prev) prev.style.display = 'none';
}