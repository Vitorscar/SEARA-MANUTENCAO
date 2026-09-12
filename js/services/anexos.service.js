/* =========================================================
   anexos.service.js — foto, áudio e vídeo
   Armazena em base64 (localStorage). Cuidado com quota!
   ========================================================= */

const LIMITE_FOTO_W    = 900;   // px
const LIMITE_FOTO_Q    = 0.72;  // jpeg
const LIMITE_AUDIO_S   = 45;    // segundos
const LIMITE_VIDEO_S   = 15;    // segundos
const LIMITE_VIDEO_W   = 640;   // px

/* ---------- util ---------- */
export function blobToBase64(blob){
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onloadend = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
}

export function base64ParaUrl(b64, mime){
  return `data:${mime};base64,${b64}`;
}

/* ---------- FOTO: resize + compressão ---------- */
export async function processarFoto(file){
  if(!file) return null;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, LIMITE_FOTO_W / bitmap.width);
  canvas.width  = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', LIMITE_FOTO_Q);
  bitmap.close?.();
  return {
    tipo: 'foto',
    mime: 'image/jpeg',
    data: dataUrl.split(',')[1],
    ts: Date.now(),
    tamanho: Math.round((dataUrl.length * 3) / 4)
  };
}

/* ---------- VÍDEO: limite de duração + tamanho ---------- */
export async function processarVideo(file){
  if(!file) return null;
  if(file.size > 8 * 1024 * 1024){
    throw new Error('Vídeo muito grande (máx 8 MB). Grave um mais curto.');
  }
  const data = await blobToBase64(file);
  return {
    tipo: 'video',
    mime: file.type || 'video/mp4',
    data,
    ts: Date.now(),
    tamanho: file.size
  };
}

/* =========================================================
   GRAVAÇÃO DE ÁUDIO
   ========================================================= */
let gravador  = null;
let chunks    = [];
let stream    = null;
let timerId   = null;
let segundos  = 0;
let onTickCb  = null;
let onEndCb   = null;

export function estaGravando(){ return !!gravador && gravador.state === 'recording'; }

export async function iniciarGravacao({ onTick, onEnd } = {}){
  if(estaGravando()) return;
  if(!navigator.mediaDevices?.getUserMedia){
    throw new Error('Gravação de áudio não suportada neste navegador.');
  }

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  gravador = new MediaRecorder(stream, { mimeType: mime });
  chunks = [];
  segundos = 0;
  onTickCb = onTick;
  onEndCb = onEnd;

  gravador.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };

  gravador.onstop = async () => {
    clearInterval(timerId);
    stream?.getTracks().forEach(t => t.stop());
    const dur = segundos;

    if(chunks.length === 0){
      onEndCb?.(null, dur);
      return limpar();
    }

    const blob = new Blob(chunks, { type: 'audio/webm' });
    const data = await blobToBase64(blob);
    const anexo = {
      tipo: 'audio',
      mime: 'audio/webm',
      data,
      ts: Date.now(),
      duracao: dur,
      tamanho: blob.size
    };

    onEndCb?.(anexo, dur);
    limpar();
  };

  gravador.start();

  timerId = setInterval(() => {
    segundos++;
    onTickCb?.(segundos);
    if(segundos >= LIMITE_AUDIO_S) pararGravacao();
  }, 1000);
}

export function pararGravacao(){
  if(estaGravando()) gravador.stop();
}

function limpar(){
  gravador = null;
  chunks = [];
  stream = null;
  clearInterval(timerId);
}

/* ---------- Persistência do draft ---------- */
export function adicionarAnexo(anexos, novo){
  if(!novo) return anexos;
  return [...(anexos || []), novo];
}

export function removerAnexo(anexos, ts){
  return (anexos || []).filter(a => a.ts !== ts);
}

/* ---------- Total em bytes ---------- */
export function pesoAnexos(anexos){
  return (anexos || []).reduce((s,a) => s + (a.tamanho || 0), 0);
}

export function formatarPeso(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
import { api } from '../data/api.js';

/* Após salvar uma parada, sobe os anexos para o Storage */
export async function uploadPendentes(paradaId, anexos){
  const resultados = [];
  for(const a of anexos || []){
    try {
      const path = await api.uploadAnexo(paradaId, a);
      resultados.push({ ...a, storagePath: path });
    } catch(err){
      console.error('Falha ao subir anexo:', err);
    }
  }
  return resultados;
}