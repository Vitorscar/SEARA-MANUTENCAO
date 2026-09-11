/* =========================================================
   router.js — navegação + guard de rota + params
   ========================================================= */

import { state } from './state.js';
import { atualizarBadges } from '../ui/badges.js';
import { toast } from '../ui/toast.js';

const views = {};

export function registrarView(nome, fn){ views[nome] = fn; }

/* Views permitidas por role (fallback se permissions.js não existir) */
const VIEWS_POR_ROLE = {
  admin:      ['radar','registro','maquinas','os','equipe','relatorios','tecnico'],
  supervisor: ['radar','registro','maquinas','os','equipe','relatorios','tecnico'],
  tecnico:    ['radar','registro','maquinas','os','relatorios']
};

export function navigate(view, params = null){
  const role = state.db.currentUser?.role || 'tecnico';
  const permitidas = VIEWS_POR_ROLE[role] || [];

  if(!permitidas.includes(view)){
    toast(`Acesso restrito para ${role}.`, 'red');
    view = 'radar';
  }

  state.currentView = view;
  state.currentParams = params;

  /* Marca o botão de nav correspondente (só quando a view tem botão) */
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  document.getElementById('view').innerHTML = '';
  views[view]?.(params);
  window.scrollTo(0,0);
  atualizarBadges();
}

export function render(){
  views[state.currentView]?.(state.currentParams);
  atualizarBadges();
}