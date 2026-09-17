/* =========================================================
   anexos.service.js — upload para Supabase Storage
   ========================================================= */

import { supabase } from '../data/supabase-client.js';

const BUCKET = 'anexos';

/* Limites */
const LIMITE_FOTO_KB   = 500;
const LIMITE_VIDEO_MB  = 20;
const LIMITE_AUDIO_S   = 60;

/* =========================================================
   HELPERS
   ========================================================= */
async function blobParaArquivo(blob, ext, mime){
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  return new File([blob], nome, { type: mime });
}

function detectarExt(mime, tipo){
  const mapa = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/mp4':  'm4a',
    'audio/mpeg': 'mp3',
    'video/mp4':  'mp4',
    'video/webm': 'webm'
  };
  return mapa[mime] || (tipo === 'foto' ? 'jpg' : 'bin');
}

/* =========================================================
   COMPRESSÃO DE FOTO
   ========================================================= */
export async function comprimirFoto(file, maxW = 1200){
  const bitmap = await createImageBitmap(file);
  const scale  = Math.min(1, maxW / bitmap.width);

  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(bitmap.width  * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.75);
  });
}

/* =========================================================
   UPLOAD GENÉRICO
   ========================================================= */
async function upload(paradaId, blob, tipo, mime, meta = {}){
  if(!paradaId) throw new Error('Parada não informada.');
  if(!blob)     throw new Error('Arquivo inválido.');

  const ext  = detectarExt(mime, tipo);
  const path = `paradas/${paradaId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  /* 1) Upload no Storage */
  const { error: errUp } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mime,
      upsert: false,
      cacheControl: '3600'
    });

  if(errUp) throw new Error('Falha no upload: ' + errUp.message);

  /* 2) Grava metadados */
  const { data: row, error: errIns } = await supabase
    .from('anexos')
    .insert({
      parada_id:    paradaId,
      tipo,
      storage_path: path,
      mime,
      tamanho:      blob.size,
      duracao:      meta.duracao || null
    })
    .select()
    .single();

  if(errIns){
    /* Rollback: remove arquivo do storage */
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(errIns.message);
  }

  return row;
}

/* =========================================================
   UPLOADS ESPECÍFICOS
   ========================================================= */
export async function uploadFoto(paradaId, file){
  if(file.size > LIMITE_FOTO_KB * 1024){
    file = await comprimirFoto(file);   // comprime automaticamente
  }
  return upload(paradaId, file, 'foto', 'image/jpeg');
}

export async function uploadVideo(paradaId, file){
  if(file.size > LIMITE_VIDEO_MB * 1024 * 1024){
    throw new Error(`Vídeo muito grande. Máx ${LIMITE_VIDEO_MB} MB.`);
  }
  return upload(paradaId, file, 'video', file.type || 'video/mp4');
}

export async function uploadAudio(paradaId, blob, duracao){
  if(duracao > LIMITE_AUDIO_S){
    throw new Error(`Áudio muito longo. Máx ${LIMITE_AUDIO_S}s.`);
  }
  return upload(paradaId, blob, 'audio', blob.type || 'audio/webm', { duracao });
}

/* =========================================================
   LISTAR ANEXOS DE UMA PARADA
   ========================================================= */
export async function listarAnexos(paradaId){
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('parada_id', paradaId)
    .order('criado_em');

  if(error) throw new Error(error.message);
  return data || [];
}

/* =========================================================
   URL ASSINADA (1h) para exibir anexo
   ========================================================= */
export async function urlAnexo(storagePath, expiraSegundos = 3600){
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiraSegundos);

  if(error) throw new Error(error.message);
  return data.signedUrl;
}

/* =========================================================
   REMOVER ANEXO
   ========================================================= */
export async function removerAnexo(id, storagePath){
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from('anexos').delete().eq('id', id);
}

/* =========================================================
   GRAVAÇÃO DE ÁUDIO (MediaRecorder)
   ========================================================= */
let gravador = null;
let chunks   = [];
let stream   = null;
let timerId  = null;
let segundos = 0;

export function estaGravando(){
  return !!gravador && gravador.state === 'recording';
}

export async function iniciarGravacao({ onTick, onEnd } = {}){
  if(estaGravando()) return;

  stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  gravador = new MediaRecorder(stream, { mimeType: mime });
  chunks   = [];
  segundos = 0;

  gravador.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };

  gravador.onstop = () => {
    clearInterval(timerId);
    stream?.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: 'audio/webm' });
    onEnd?.(blob, segundos);
  };

  gravador.start();
  timerId = setInterval(() => {
    segundos++;
    onTick?.(segundos);
    if(segundos >= LIMITE_AUDIO_S) pararGravacao();
  }, 1000);
}

export function pararGravacao(){
  if(estaGravando()) gravador.stop();
}
/* =========================================================
   HELPERS — formatação de tamanho
   ========================================================= */
export function formatarPeso(bytes){
  bytes = Number(bytes) || 0;
  if(bytes < 1024)         return bytes + ' B';
  if(bytes < 1024 * 1024)  return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}