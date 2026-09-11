import { state } from '../core/state.js';
import { toast } from '../ui/toast.js';

export function toggleDitado(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ toast('Ditado não suportado neste navegador.', 'red'); return; }

  const btn = document.getElementById('btnMic');
  if(state.ditando){ state.reconhecimento?.stop(); return; }

  state.reconhecimento = new SR();
  state.reconhecimento.lang = 'pt-BR';
  state.reconhecimento.continuous = true;
  state.reconhecimento.interimResults = true;

  const base = document.getElementById('fCausaRaiz').value;

  state.reconhecimento.onstart = () => {
    state.ditando = true;
    btn.classList.add('rec');
    toast('🎤 Ouvindo…');
  };
  state.reconhecimento.onresult = ev => {
    let txt = '';
    for(let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
    document.getElementById('fCausaRaiz').value = (base ? base + ' ' : '') + txt;
  };
  state.reconhecimento.onerror = () => {};
  state.reconhecimento.onend = () => {
    state.ditando = false;
    btn?.classList.remove('rec');
  };
  state.reconhecimento.start();
}