/* =========================================================
   router.js — navegação, guards e cache de template
   
   Uso:
     registerRoute(path, { template?, controller, guard? })
     controller: função(root, params) OU { mount(root, params), unmount?() }
   ========================================================= */

import { state }           from './state.js';
import { atualizarBadges } from '../ui/badges.js';
import { toast }           from '../ui/toast.js';

/* =========================================================
   ESTADO INTERNO
   ========================================================= */
const routes        = new Map();
const templateCache = new Map();

let currentController = null;
let currentPath       = null;
let isLoading         = false;

/* =========================================================
   REGISTRO DE ROTAS
   ========================================================= */
export function registerRoute(path, config){
  if(!config || typeof config !== 'object'){
    console.error(`[router] config inválida para "${path}"`, config);
    return;
  }
  if(!config.controller){
    console.error(`[router] rota "${path}" sem controller`);
    return;
  }

  routes.set(path, {
    template:   config.template || null,
    controller: config.controller,
    guard:      typeof config.guard === 'function' ? config.guard : null
  });
}

/* Alias legado */
export function registrarView(nome, fn){
  registerRoute(nome, { controller: fn });
}

/* =========================================================
   CACHE DE TEMPLATE
   ========================================================= */
async function fetchTemplate(path){
  if(templateCache.has(path)) return templateCache.get(path);

  const res = await fetch(path);
  if(!res.ok){
    throw new Error(`Template não encontrado (${res.status}): ${path}`);
  }
  const html = await res.text();
  templateCache.set(path, html);
  return html;
}

export function invalidarTemplate(path){ templateCache.delete(path); }
export function limparCacheTemplates(){ templateCache.clear(); }

/* =========================================================
   GUARDS
   ========================================================= */
const PUBLICAS = ['login'];

function temSessaoValida(){
  try {
    const raw = localStorage.getItem('seara_sessao_v1');
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s?.expiraEm || s.expiraEm < Date.now()){
      localStorage.removeItem('seara_sessao_v1');
      return false;
    }
    return true;
  } catch(e){
    return false;
  }
}

export function estaLogado(){
  return !!(state.db?.currentUser && temSessaoValida());
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */
export async function navigate(path, params = {}){
  if(isLoading){
    console.warn('[router] navegação em andamento, ignorando:', path);
    return;
  }

  let route = routes.get(path);
  if(!route){
    console.error(`[router] rota desconhecida: "${path}"`);
    console.table([...routes.keys()]);
    toast(`Rota "${path}" não existe`, 'error');
    return;
  }

  /* ---- Guard de login ---- */
  const logado = estaLogado();
  if(!logado && !PUBLICAS.includes(path)) path = 'login';
  if(logado  && path === 'login')         path = 'radar';

  route = routes.get(path);
  if(!route){
    console.error(`[router] rota de redirect não existe: "${path}"`);
    return;
  }

  /* ---- Guard customizado ---- */
  if(route.guard){
    try {
      if(!route.guard(params)){
        toast('Acesso restrito.', 'error');
        return;
      }
    } catch(err){
      console.error('[router] guard lançou erro:', err);
      toast('Erro ao validar acesso.', 'error');
      return;
    }
  }

  /* ---- Outlet ---- */
  const outlet = document.getElementById('view');
  if(!outlet){
    console.error('[router] #view não encontrado');
    return;
  }

  isLoading = true;
  document.dispatchEvent(new CustomEvent('router:loading', { detail: true }));

  try {
    /* 1) Desmonta controller anterior */
    if(currentController?.unmount){
      try { currentController.unmount(); }
      catch(err){ console.warn('[router] unmount falhou:', err); }
    }

    /* 2) Limpa outlet (evita resíduo da view anterior) */
    outlet.innerHTML = '';

    /* 3) Injeta template se houver */
    if(route.template){
      outlet.innerHTML = await fetchTemplate(route.template);
    }

    /* 4) URL + nav ativo */
    currentPath = path;
    if(window.location.hash !== '#' + path){
      window.location.hash = path;
    }
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === path);
    });

    /* 5) Chama mount */
    currentController = route.controller;
    if(typeof route.controller === 'function'){
      await route.controller(outlet, params);
    } else if(typeof route.controller.mount === 'function'){
      await route.controller.mount(outlet, params);
    } else {
      console.error(`[router] controller inválido em "${path}"`, route.controller);
    }

    /* 6) Estado */
    state.currentView   = path;
    state.currentParams = params;
    window.scrollTo(0, 0);
    atualizarBadges();

  } catch(err){
    console.error('[router] erro ao navegar:', err);
    toast(err.message || 'Erro ao carregar.', 'error');
  } finally {
    isLoading = false;
    document.dispatchEvent(new CustomEvent('router:loading', { detail: false }));
  }
}

/* =========================================================
   RE-RENDER E RECARREGAR
   ========================================================= */
export async function render(){
  if(currentPath) await navigate(currentPath, state.currentParams || {});
}

export async function recarregar(params = {}){
  if(currentPath){
    const route = routes.get(currentPath);
    if(route?.template) invalidarTemplate(route.template);
    await navigate(currentPath, params);
  }
}

/* =========================================================
   GETTERS
   ========================================================= */
export function getCurrentPath(){ return currentPath; }
export function getCurrentController(){ return currentController; }
export function listarRotas(){ return [...routes.keys()].sort(); }
export function estaCarregando(){ return isLoading; }

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
export function initRouter(defaultPath = 'login'){
  window.addEventListener('hashchange', () => {
    const raw = window.location.hash.replace(/^#/, '') || defaultPath;
    if(raw !== currentPath) navigate(raw);
  });

  const inicial = window.location.hash.replace(/^#/, '') || defaultPath;
  navigate(inicial);
}