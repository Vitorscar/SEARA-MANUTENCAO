import { state, salvarDB } from '../core/state.js';
import { toast } from '../ui/toast.js';

export async function abrirQR(){
  if(!window.jsQR){ toast('Leitor QR não carregou. Digite o nome.', 'red'); return; }

  document.getElementById('qrOverlay').classList.add('ativo');
  document.getElementById('qrHint').textContent = 'Procurando código…';

  try{
    state.qrStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    const video = document.getElementById('qrVideo');
    video.srcObject = state.qrStream;
    await video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function loop(){
      if(video.readyState === video.HAVE_ENOUGH_DATA){
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height);

        if(code && code.data){
          const codigo = code.data.trim();
          let maq = state.db.maquinas.find(m =>
            m.qr === codigo || m.nome.toLowerCase() === codigo.toLowerCase()
          );
          if(!maq){
            maq = {id:'m'+Date.now(), nome:codigo, setor:'', prioridade:2, status:'parada', qr:codigo};
            state.db.maquinas.push(maq);
            salvarDB();
          }
          const f = document.getElementById('fEquipamento') || document.getElementById('fMaquina');
if(f){
  f.value = maq.nome;
  f.dispatchEvent(new Event('change', { bubbles: true }));
}
          const s = document.getElementById('fSetor');   if(s && maq.setor) s.value = maq.setor;

          document.getElementById('qrHint').textContent = '✅ ' + codigo;
          if(navigator.vibrate) navigator.vibrate(50);
          toast('Máquina identificada: ' + maq.nome, 'green');
          setTimeout(fecharQR, 500);
          return;
        }
      }
      state.qrLoopId = requestAnimationFrame(loop);
    }
    loop();
  }catch(err){
    document.getElementById('qrHint').textContent = 'Câmera indisponível — digite manualmente.';
    toast('Não foi possível acessar a câmera.', 'red');
  }
}

export function fecharQR(){
  document.getElementById('qrOverlay').classList.remove('ativo');
  if(state.qrLoopId) cancelAnimationFrame(state.qrLoopId);
  if(state.qrStream){
    state.qrStream.getTracks().forEach(t => t.stop());
    state.qrStream = null;
  }
}