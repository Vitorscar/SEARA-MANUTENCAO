/* =========================================================
   app.js — boot + wiring
   Ordem: imports → helpers → guards → rotas → boot
   Login é essencial; o resto é lazy com auto-expose
   ========================================================= */

/* ---------- Core ---------- */
import { initState, state, salvarDB }              from './core/state.js';
import { registerRoute, initRouter, navigate, render } from './core/router.js';
import { on }                                       from './core/events.js';
import { turnoAtual, nowStr }                       from './core/utils.js';
import { estaLogado, logout }                       from './services/auth.service.js';
import { toast }                                    from './ui/toast.js';
import { closeModal }                               from './ui/modal.js';

/* ---------- Detalhe de parada (usado em relatórios/extrato) ---------- */
import {
  abrirDetalheParada,
  abrirDetalheParadaPorId,
  abrirZoom,
  exportarParada
} from './ui/parada-detail.js';

/* ---------- Login: import direto (essencial, sempre carregado) ---------- */
import * as loginView from './views/login.view.js';

/* =========================================================
   1) CONFIGURAÇÕES
   ========================================================= */
const SCHEMA_VERSION = 'v6';

/* =========================================================
   2) GUARDS
   ========================================================= */
const isLoggedIn = () => !!state.db?.currentUser || estaLogado();
const isAdmin    = () => (state.db?.currentUser || {}).role === 'admin';

/* =========================================================
   3) HELPERS
   ========================================================= */

/* Wrapper — transforma função de view em controller
   + seta a classe do body pra esconder shell no login */
function wrapView(fn, routePath){
  return {
    async mount(_root, params){
      document.body.className = 'route-' + (routePath || 'view');
      await fn(params);
    },
    unmount(){}
  };
}

/* Auto-expose — joga todos os exports de um módulo em window
   Assim os onclick/onsubmit inline do HTML encontram as funções */
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
   4) ROTAS ESSENCIAIS (carregadas imediatamente)
   ========================================================= */
registerRoute('login', {
  controller: wrapView(loginView.renderLogin, 'login')
});

/* Expor exports do login direto (ex: submit handlers) */
autoExpose(loginView);

/* =========================================================
   5) ROTAS LAZY (carregadas sob demanda)
   ========================================================= */
const LAZY_ROUTES = [
  { path: 'relatorios', modulo: './views/relatorios.view.js', render: 'renderRelatorios', guard: isLoggedIn },
  { path: 'extrato',    modulo: './views/extrato.view.js',    render: 'renderExtrato',    guard: isLoggedIn },
  { path: 'maquinas',   modulo: './views/maquinas.view.js',   render: 'renderMaquinas',   guard: isLoggedIn },
  { path: 'equipe',     modulo: './views/equipe.view.js',     render: 'renderEquipe',     guard: isAdmin    },
  { path: 'registro',   modulo: './views/registro.view.js',   render: 'renderRegistro',   guard: isLoggedIn },
  { path: 'radar',      modulo: './views/radar.view.js',      render: 'renderRadar',      guard: isLoggedIn },
  { path: 'os',         modulo: './views/os.view.js',         render: 'renderOS',         guard: isLoggedIn },
  { path: 'tecnico',    modulo: './views/tecnico.view.js',    render: 'renderTecnico',    guard: isAdmin    }
];

async function registrarRotasLazy(){
  for(const item of LAZY_ROUTES){
    try {
      const m = await import(item.modulo);

      /* ⚡ expõe todos os exports (salvarRegistro, onFoto, chips, etc) */
      autoExpose(m);

      /* Registra a rota */
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
   6) WIRING GLOBAL
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
   7) EVENTOS
   ========================================================= */
on('undo:aplicado', () => { render(); });

/* =========================================================
   8) EXPOSIÇÃO GLOBAL (helpers do próprio app)
   ========================================================= */
Object.assign(window, {
  /* ── Core ── */
  navigate,
  logout,
  render,
  __render: render,

  /* ── UI ── */
  closeModal,
  toast,

  /* ── Utils ── */
  turnoAtual,
  nowStr,
  __utils: { turnoAtual, nowStr },

  /* ── Detalhe de parada (usado pelo relatório / extrato) ── */
  abrirDetalheParada,
  abrirDetalheParadaPorId,
  abrirZoom,
  exportarParada,

  /* ── Navegação específica ── */
  tecnicoVoltar: () => navigate('equipe')
});

/* =========================================================
   9) BOOT
   ========================================================= */
async function boot(){
  /* Reset de cache se schema mudou */
  if(localStorage.getItem('schema_version') !== SCHEMA_VERSION){
    console.log('[boot] schema novo — limpando cache');
    ['seara_cache', 'seara_cache_v2', 'seara_sessao_v1',
     'manutencao_seara_v1', 'manure_seara_v1'].forEach(k =>
      localStorage.removeItem(k)
    );
    localStorage.setItem('schema_version', SCHEMA_VERSION);
  }

  /* Init state (com fallback garantido) */
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

  /* Wiring de UI (independente do login) */
  setupNetwork();
  setupKeyboard();
  setupNavigation();
  setupBeforeUnload();
  startClock();

  /* Registra rotas lazy + auto-expose */
  await registrarRotasLazy();

  /* Rota inicial */
  const logado = estaLogado() || !!state.db?.currentUser;

  if(!logado){
    console.log('[boot] não logado → login');
    initRouter('login');
    return;
  }

  montarTopbarUsuario();

  const role = state.db?.currentUser?.role;

  /* Admin → relatórios · Funcionário → registro */
  if(role === 'admin'){
    console.log('[boot] logado como admin → relatorios');
    initRouter('relatorios');
  } else {
    console.log('[boot] logado como técnico → registro');
    initRouter('registro');
  }
}

boot();
