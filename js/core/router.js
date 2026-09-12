/* =========================================================
   router.js — navegação + guard de autenticação
   ========================================================= */

import { state } from './state.js';
import { atualizarBadges } from '../ui/badges.js';
import { toast } from '../ui/toast.js';

const views = {};
const PUBLICAS = ['login'];

export function registrarView(nome, fn){ views[nome] = fn; }

/* Verifica login SEM depender de import circular */
function estaLogado(){
  const user = state.db?.currentUser;
  if(!user) return false;

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

export function navigate(view, params = null){
  /* ---- GUARD 1: bloqueia tudo se não logado ---- */
  if(!estaLogado() && !PUBLICAS.includes(view)){
    view = 'login';
  }

  /* ---- GUARD 2: logado não volta pra login ---- */
  if(estaLogado() && view === 'login'){
    view = 'radar';
  }

  /* ---- GUARD 3: permissão por role ---- */
  const role = state.db?.currentUser?.role;
  const permitidas = {
    admin:      ['radar','registro','maquinas','os','equipe','tecnico','relatorios'],
    supervisor: ['radar','registro','maquinas','os','equipe','tecnico','relatorios'],
    tecnico:    ['radar','registro','maquinas','os','relatorios']
  }[role] || ['radar','registro','maquinas','os','relatorios'];

  if(estaLogado() && !permitidas.includes(view) && view !== 'login'){
    toast(`Acesso restrito para ${role}.`, 'red');
    view = 'radar';
  }

  state.currentView = view;
  state.currentParams = params;

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  const viewEl = document.getElementById('view');
  if(viewEl) viewEl.innerHTML = '';

  views[view]?.(params);
  window.scrollTo(0,0);
  atualizarBadges();
}

export function render(){
  views[state.currentView]?.(state.currentParams);
  atualizarBadges();
}