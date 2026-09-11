/* Pub/sub minimalista — usado para desacoplar views de services */

const listeners = {};

export function on(evt, fn){
  (listeners[evt] ||= []).push(fn);
}

export function off(evt, fn){
  if(!listeners[evt]) return;
  listeners[evt] = listeners[evt].filter(f => f !== fn);
}

export function emit(evt, payload){
  (listeners[evt] || []).forEach(fn => {
    try { fn(payload); } catch(e){ console.error(e); }
  });
}