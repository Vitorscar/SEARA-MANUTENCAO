/* =========================================================
   app.js — boot, wiring global e exposição para onclick inline
   ========================================================= */

/* =========================================================
   1) IMPORTS
   ========================================================= */
// Core
import { initState, state, salvarDB } from './core/state.js';
import { registrarView, navigate, render } from './core/router.js';
import { on } from './core/events.js';
import { turnoAtual, nowStr } from './core/utils.js';

// UI & Utils
import { closeModal } from './ui/modal.js';
import { desfazer } from './ui/undo.js';
import { toast } from './ui/toast.js';
import { abrirDetalheParada, abrirDetalheParadaPorId, abrirZoom, exportarParada } from './ui/parada-detail.js';

// Serviços
import { estaLogado, logout } from './services/auth.service.js';
import { toggleDitado } from './services/voz.service.js';
import { abrirQR, fecharQR } from './services/qr.service.js';

// Views
import { renderLogin } from './views/login.view.js';
import { renderRadar, irParaRegistro, abrirAtender, abrirVoltou, abrirAssumir, confirmarAssumir, abrirEncerrar, irParaEncerramento, abrirCorrigir } from './views/radar.view.js';
import { renderRegistro, salvarRegistro, cancelarRegistro, onFoto, onVideo, toggleAudio, removerAnexoItem } from './views/registro.view.js';
import { renderMaquinas, abrirNovaMaquina, confirmarNovaMaquina, registrarParaMaquina } from './views/maquinas.view.js';
import { renderOS } from './views/os.view.js';
import { renderRelatorios, exportarCSV, limparFiltrosRelatorios } from './views/relatorios.view.js';
import { renderEquipe, abrirNovoTecnico, confirmarNovoTecnico, abrirEditarTecnico, confirmarEditarTecnico, confirmarDesativar, abrirDirecionar, confirmarDirecionar, limparFiltrosEquipe } from './views/equipe.view.js';
import { renderTecnico } from './views/tecnico.view.js';

/* =========================================================
   2) CONFIGURAÇÕES GLOBAIS
   ========================================================= */
const SCHEMA_VERSION = 'v3';
let clockIntervalId = null;

/* =========================================================
   3) FUNÇÕES DE SETUP (Wiring)
   ========================================================= */
function setupNetwork() {
  function atualizarRede() {
    const pill = document.getElementById('net-pill');
    const txt = document.getElementById('netText');
    if (!pill || !txt) return;
    
    if (navigator.onLine) {
      pill.classList.remove('offline');
      txt.textContent = 'Online';
    } else {
      pill.classList.add('offline');
      txt.textContent = 'Offline';
    }
  }
  
  window.addEventListener('online', atualizarRede);
  window.addEventListener('offline', atualizarRede);
  atualizarRede();
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      const qr = document.getElementById('qrOverlay');
      if (qr?.classList.contains('ativo')) fecharQR();
    }
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (targetView) navigate(targetView);
    });
  });
}

function setupBeforeUnload() {
  window.addEventListener('beforeunload', e => {
    if (!state.db?.paradas) return;
    const hasOpenParadas = state.db.paradas.some(p => p.status !== 'encerrada');
    if (hasOpenParadas) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function startClock() {
  if (clockIntervalId) clearInterval(clockIntervalId);

  function tick() {
    const el = document.getElementById('greetText');
    if (!el) return;

    const h = new Date().getHours();
    const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const user = state.db?.currentUser;
    const nome = user?.nome ? user.nome.split(' ')[0] : 'Visitante';

    el.innerHTML = `${saud}, ${nome}.<span class="time">${turnoAtual()} · ${nowStr()}</span>`;
  }

  tick();
  clockIntervalId = setInterval(tick, 30000);
}

/* =========================================================
   4) SISTEMA DE NOTIFICAÇÕES
   ========================================================= */
async function atualizarNotificacoes() {
  const user = state.db?.currentUser;
  if (!user || user.role === 'admin') return;

  try {
    const { api } = await import('./data/api.js');
    const lista = await api.minhasNotificacoes(user.id);
    const naoLidas = lista.filter(n => !n.lida).length;

    const el = document.getElementById('notifCount');
    if (el) {
      el.textContent = naoLidas;
      el.classList.toggle('hidden', naoLidas === 0);
    }
    window.__notificacoes = lista;
  } catch (e) {
    // Offline ou erro silencioso
  }
}

async function abrirNotificacoes() {
  const lista = window.__notificacoes || [];
  const { openModal } = await import('./ui/modal.js');

  const html = lista.length === 0
    ? `<div class="empty" style="padding:20px; text-align:center;">Nenhuma notificação.</div>`
    : lista.map(n => `
        <div class="notif-item ${n.lida ? 'lida' : ''}" style="cursor:pointer; padding:10px; border-bottom:1px solid var(--border);" onclick="marcarLida('${n.id}')">
          <div style="font-weight:700; font-size:13px;">${n.titulo}</div>
          <div style="font-size:12.5px; color:var(--muted); margin-top:4px;">${n.mensagem}</div>
          <div style="font-size:10.5px; color:var(--muted-2); margin-top:6px;">${new Date(n.criado_em).toLocaleString('pt-BR')}</div>
        </div>
      `).join('');

  openModal('', '🔔', 'Notificações', html);
}

async function setupNotificacoes() {
  const user = state.db?.currentUser;
  if (!user || user.role === 'admin') return;

  const topbar = document.getElementById('topbar');
  if (!topbar || topbar.querySelector('#notif-sino')) return;

  const btn = document.createElement('button');
  btn.id = 'notif-sino';
  btn.className = 'notif-sino';
  btn.title = 'Notificações';
  btn.innerHTML = `🔔<span class="notif-badge hidden" id="notifCount">0</span>`;
  btn.onclick = abrirNotificacoes;
  topbar.appendChild(btn);

  await atualizarNotificacoes();
  setInterval(atualizarNotificacoes, 30000);
}

/* =========================================================
   5) REGISTRO DE VIEWS NO ROUTER
   ========================================================= */
registrarView('login', renderLogin);
registrarView('radar', renderRadar);
registrarView('registro', renderRegistro);
registrarView('maquinas', renderMaquinas);
registrarView('os', renderOS);
registrarView('equipe', renderEquipe);
registrarView('tecnico', renderTecnico);
registrarView('relatorios', renderRelatorios);

/* =========================================================
   6) EVENTOS DESACOPLADOS
   ========================================================= */
on('undo:aplicado', render);

/* =========================================================
   7) EXPOSIÇÃO GLOBAL (para onclick inline no HTML)
   ========================================================= */
Object.assign(window, {
  /* Navegação e Estado */
  __render: render,
  navigate,
  __utils: { turnoAtual, nowStr },
  
  /* Ficha do Técnico */
  abrirTecnico: (id) => {
    state.tecnicoAtualId = id;
    navigate('tecnico', { id });
  },

  /* Notificações */
  marcarLida: async (id) => {
    const { api } = await import('./data/api.js');
    await api.marcarNotifLida(id);
    await atualizarNotificacoes();
    // Reabre o modal para atualizar a UI
    abrirNotificacoes();
  },

  /* Radar */
  irParaRegistro, abrirAtender, abrirVoltou, abrirAssumir, confirmarAssumir, abrirEncerrar, irParaEncerramento, abrirCorrigir,

  /* Registro */
  salvarRegistro, cancelarRegistro, toggleDitado, onFoto, onVideo, toggleAudio, removerAnexoItem,

  /* Máquinas */
  abrirNovaMaquina, confirmarNovaMaquina, registrarParaMaquina,

  /* Equipe */
  abrirNovoTecnico, confirmarNovoTecnico, abrirEditarTecnico, confirmarEditarTecnico, confirmarDesativar, abrirDirecionar, confirmarDirecionar, limparFiltrosEquipe,

  /* Detalhe da parada */
  abrirDetalheParada, abrirDetalheParadaPorId, abrirZoom, exportarParada,

  /* QR e UI Geral */
  abrirQR, fecharQR, exportarCSV, limparFiltrosRelatorios, logout, closeModal, desfazer
});

/* =========================================================
   8) UI: TOPBAR
   ========================================================= */
function montarTopbarUsuario() {
  const user = state.db?.currentUser;
  if (!user) return;

  const topbar = document.getElementById('topbar');
  if (!topbar) return;

  const existingChip = topbar.querySelector('.user-chip');
  if (existingChip) existingChip.remove();

  const iniciais = user.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = user.role === 'admin' ? 'ADM' : (user.role === 'supervisor' ? 'SUP' : 'TEC');

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
    if (confirm(`Sair da conta de ${user.nome}?`)) logout();
  };
  
  topbar.appendChild(chip);
}

/* =========================================================
   9) BOOT PRINCIPAL (Orquestração)
   ========================================================= */
async function boot() {
  try {
    // 1. Verificação e limpeza de schema
    if (localStorage.getItem('schema_version') !== SCHEMA_VERSION) {
      console.log('[boot] Schema alterado. Limpando cache local...');
      ['manure_seara_v1', 'seara_cache', 'seara_sessao_v1', 'manutencao_seara_v1'].forEach(key => {
        localStorage.removeItem(key);
      });
      localStorage.setItem('schema_version', SCHEMA_VERSION);
    }

    // 2. Inicializa o estado (aguarda carga do Supabase/Local)
    await initState();

    // 3. Configura listeners globais
    setupNetwork();
    setupKeyboard();
    setupNavigation();
    setupBeforeUnload();

    // 4. Inicia relógio
    startClock();

    // 5. Roteamento inicial e setups dependentes de login
    if (estaLogado()) {
      montarTopbarUsuario();
      await setupNotificacoes(); // ← Integrado corretamente aqui
      navigate('radar');
    } else {
      navigate('login');
    }

    console.log('[boot] Aplicação inicializada com sucesso.');
  } catch (error) {
    console.error('[boot] Falha crítica na inicialização:', error);
    toast('Erro ao carregar o sistema. Verifique sua conexão e recarregue a página.', 'red');
    navigate('login');
  }
}

// Inicia a aplicação
boot();