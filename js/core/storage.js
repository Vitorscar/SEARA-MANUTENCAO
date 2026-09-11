/* Acesso cru ao localStorage, com try/catch centralizado */

export const DB_KEY = 'manutencao_seara_v1';

export function getLS(k){
  try { return localStorage.getItem(k); } catch(e){ return null; }
}

export function setLS(k, v){
  try { localStorage.setItem(k, v); return true; }
  catch(e){ return false; }
}