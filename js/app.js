/* =========================================================
   app.js — boot + wiring
   Login primeiro, resto carregado sob demanda (lazy)
   Auto-expose: todo export das views vai pro window
   ========================================================= */

/* ---------- Essencial (top-level, nunca quebra) ---------- */
import { initState, state, salvarDB }              from './core/state.js';
import { registerRoute, initRouter, navigate, render } from './core/router.js';
import { on }                                       from './core/events.js';
import { turnoAtual, nowStr }                       from './core/utils.js';
import { estaLogado, logout }                       from './services/auth.service.js';
import { toast }                                    from './ui/toast.js';
import { closeModal }                               from './ui/modal.js';

/* ---------- Login: import direto (essencial) ---------- */
import * as loginView from './views/login.view.js';

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */
const SCHEMA_VERSION = 'v6';

/* =========================================================
   GUARDS
   ========================================================= */
const isLoggedIn = () => !!state.db?.currentUser || estaLogado();
const isAdmin    = () => (state.db?.currentUser || {}).role === 'admin';

/* =========================================================
   WRAPPER — transforma função de view em controller
   + seta a classe do body pra esconder shell no login
   ========================================================= */
function wrapView(fn, routePath){
  return {
    async mount(_root, params){
      document.body.className = 'route-' + (routePath || 'view');
      await fn(params);
    },
    unmount(){}
  };
}

/* =========================================================
   AUTO-EXPOSE — joga todos os exports de um módulo em window
   Assim os onclick/onsubmit inline do HTML encontram as funções
   ========================================================= */
function autoExpose(modulo, opts = {}){
  const { ignore = [] } = opts;
  let count = 0;

  Object.keys(modulo).forEach(key => {
    if(ignore.includes(key)) return;
    if(typeof window[key] === 'undefined'){
      window[key] = modulo[key];
      count++;
    }
  });

  return count;
}

/* =========================================================
   ROTAS ESSENCIAIS
   ========================================================= */
registerRoute('login', {
  controller: wrapView(loginView.renderLogin, 'login')
});

/* Expor exports do login direto */
autoExpose(loginView);

/* =========================================================
   ROTAS SOB DEMANDA (lazy)
   Cada view = { path, módulo, export da função de render, guard }
   ========================================================= */
const LAZY_ROUTES = [
  { path: 'radar',      modulo: './views/radar.view.js',      render: 'renderRadar',      guard: isLoggedIn },
  { path: 'registro',   modulo: './views/registro.view.js',   render: 'renderRegistro',   guard: isLoggedIn },
  { path: 'maquinas',   modulo: './views/maquinas.view.js',   render: 'renderMaquinas',   guard: isLoggedIn },
  { path: 'os',         modulo: './views/os.view.js',         render: 'renderOS',         guard: isLoggedIn },
  { path: 'equipe',     modulo: './views/equipe.view.js',     render: 'renderEquipe',     guard: isAdmin    },
  { path: 'tecnico',    modulo: './views/tecnico.view.js',    render: 'renderTecnico',    guard: isAdmin    },
  { path: 'relatorios', modulo: './views/relatorios.view.js', render: 'renderRelatorios', guard: isLoggedIn }
];

async function registrarRotasLazy(){
  for(const item of LAZY_ROUTES){
    try {
      const m = await import(item.modulo);

      /* ⚡ expõe tudo (salvarRegistro, onFoto, chips, etc) */
      autoExpose(m);

      /* Registra a rota com o controller */
      const fn = m[item.render];
      if(typeof fn !== 'function'){
        console.warn(`[app] "${item.modulo}" não exporta "${item.render}"`);
        continue;
      }

      registerRoute(item.path, {
        controller: wrapView(fn, item.path),
        guard: item.guard
      });

    } catch(err){
      console.warn(`[app] rota "${item.path}" não registrada:`, err.message);
    }
  }
}

/* =========================================================
   WIRING GLOBAL
   ========================================================= */

/* ---------- Rede ---------- */
function setupNetwork(){
  function atualizarRede(){
    const pill = document.getElementById('net-pill');
    const txt  = document.getElementById('netText');
    if(!pill || !txt) return;
    if(navigator.onLine){
      pill.classList.remove('offline');
      txt.textContent = 'Online';
    } else {
      pill.classList.add('offline');
      txt.textContent = 'Offline';
    }
  }
  window.addEventListener('online',  atualizarRede);
  window.addEventListener('offline', atualizarRede);
  atualizarRede();
}

/* ---------- Teclado ---------- */
function setupKeyboard(){
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      closeModal();
      const qr = document.getElementById('qrOverlay');
      if(qr?.classList.contains('ativo')){
        try { window.fecharQR?.(); } catch(_){}
      }
    }
  });
}

/* ---------- Nav ---------- */
function setupNavigation(){
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if(btn.dataset.view) navigate(btn.dataset.view);
    });
  });
}

/* ---------- Aviso de saída ---------- */
function setupBeforeUnload(){
  window.addEventListener('beforeunload', e => {
    if(!state.db?.paradas) return;
    if(state.db.paradas.some(p => p.status !== 'encerrada')){
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ---------- Relógio ---------- */
let clockIntervalId = null;
function startClock(){
  if(clockIntervalId) clearInterval(clockIntervalId);
  function tick(){
    const el = document.getElementById('greetText');
    if(!el) return;
    const h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const user = state.db?.currentUser;
    const nome = user?.nome ? user.nome.split(' ')[0] : 'Visitante';
    el.innerHTML = `${saud}, ${nome}.<span class="time">${turnoAtual()} · ${nowStr()}</span>`;
  }
  tick();
  clockIntervalId = setInterval(tick, 30000);
}

/* ---------- Topbar: chip do usuário ---------- */
function montarTopbarUsuario(){
  const user = state.db?.currentUser;
  if(!user) return;
  const topbar = document.getElementById('topbar');
  if(!topbar) return;

  const existing = topbar.querySelector('.user-chip');
  if(existing) existing.remove();

  const iniciais = user.nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
  const roleLabel = user.role === 'admin' ? 'ADM'
                  : user.role === 'supervisor' ? 'SUP'
                  : 'TEC';

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'user-chip';
  chip.title = 'Clique para sair';
  chip.innerHTML = `
    <span class="uc-avatar">${iniciais}</span>
    <span>${user.nome.split(' ')[0]}</span>
    <span class="uc-role ${user.role}">${roleLabel}</span>
  `;
  chip.onclick = () => {
    if(confirm(`Sair da conta de ${user.nome}?`)) logout();
  };
  topbar.appendChild(chip);
}

/* =========================================================
   EVENTOS
   ========================================================= */
on('undo:aplicado', () => { render(); });

/* =========================================================
   EXPOSIÇÃO GLOBAL — helpers do próprio app
   (as views se auto-expõem via autoExpose)
   ========================================================= */
Object.assign(window, {
  /* Core */
  navigate,
  logout,
  render,
  __render: render,

  /* UI */
  closeModal,
  toast,

  /* Utils */
  turnoAtual,
  nowStr,
  __utils: { turnoAtual, nowStr },

  /* Navegação específica */
  tecnicoVoltar: () => navigate('equipe')
});

/* =========================================================
   BOOT
   ========================================================= */
async function boot(){
  /* 1) Reset de cache se schema mudou */
  if(localStorage.getItem('schema_version') !== SCHEMA_VERSION){
    console.log('[boot] schema novo — limpando cache');
    ['seara_cache', 'seara_cache_v2', 'seara_sessao_v1',
     'manutencao_seara_v1', 'manure_seara_v1'].forEach(k =>
      localStorage.removeItem(k)
    );
    localStorage.setItem('schema_version', SCHEMA_VERSION);
  }

  /* 2) Init state (com fallback garantido) */
  try {
    await initState();
  } catch(err){
    console.error('[boot] initState falhou:', err);
    if(!state.db){
      state.db = {
        maquinas: [], tecnicos: [], paradas: [], os: [],
        usuarios: [], equipamentosDescobertos: {}, seqParada: 1,
        currentUser: null, sessao: null
      };
    }
  }

  /* 3) Wiring de UI (independente do login) */
  setupNetwork();
  setupKeyboard();
  setupNavigation();
  setupBeforeUnload();
  startClock();

  /* 4) Registra rotas lazy + auto-expose */
  await registrarRotasLazy();

  /* 5) Rota inicial */
  const logado = estaLogado() || !!state.db?.currentUser;

  if(!logado){
    console.log('[boot] não logado → login');
    initRouter('login');
    return;
  }

  montarTopbarUsuario();
  console.log(`[boot] logado como ${state.db.currentUser?.role} → radar`);
  initRouter('radar');
}

boot();