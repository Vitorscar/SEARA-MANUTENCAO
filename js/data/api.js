/* Adapter — troque aqui por Supabase/REST sem mexer no resto */

import { seed } from './seed.js';
import { getLS, setLS, DB_KEY } from '../core/storage.js';

export const api = {
  load(){
    try{
      const raw = getLS(DB_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    const s = seed();
    setLS(DB_KEY, JSON.stringify(s));
    return s;
  },

  save(db){
    return setLS(DB_KEY, JSON.stringify(db));
  }
};