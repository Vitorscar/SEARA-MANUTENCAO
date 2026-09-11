/* =========================================================
   app.js — boot, wiring global, exposição para onclick inline
   ========================================================= */

import { initState, state } from './core/state.js';
import { registrarView, navigate, render } from './core/router.js';
import { on } from './core/events.js';
import { desfazer } from './ui/undo.js';
import { closeModal } from './ui/modal.js';
import { turnoAtual, nowStr } from './core/utils.js';

/* ---------- Views ---------- */
import { renderRadar, irParaRegistro, abrirAtender, abrirVoltou,
         abrirAssumir, confirmarAssumir, abrirEncerrar, irParaEncerramento,
         abrirCorrigir } from './views/radar.view.js';

import { renderRegistro, salvarRegistro, cancelarRegistro,
         onFoto, onVideo, toggleAudio,
         removerAnexoItem } from './views/registro.view.js';

import { toggleDitado } from './services/voz.service.js';

import { renderMaquinas, abrirNovaMaquina, confirmarNovaMaquina,
         registrarParaMaquina } from './views/maquinas.view.js';

import { renderOS } from './views/os.view.js';

import { renderRelatorios, exportarCSV, limparFiltrosRelatorios }
  from './views/relatorios.view.js';

import { renderEquipe, abrirNovoTecnico, confirmarNovoTecnico,
         abrirEditarTecnico, confirmarEditarTecnico, confirmarDesativar,
         abrirDirecionar, confirmarDirecionar,
         limparFiltrosEquipe } from './views/equipe.view.js';

import { renderTecnico } from './views/tecnico.view.js';

/* ---------- Serviços usados pela UI global ---------- */
import { abrirQR, fecharQR } from './services/qr.service.js';
import { abrirDetalheParada, abrirDetalheParadaPorId, abrirZoom, exportarParada }
  from './ui/parada-detail.js';
/* =========================================================
   1) Estado
   ========================================================= */
initState();

/* =========================================================
   2) Registrar views no router
   ========================================================= */
registrarView('radar',      renderRadar);
registrarView('registro',   renderRegistro);
registrarView('maquinas',   renderMaquinas);
registrarView('os',         renderOS);
registrarView('equipe',     renderEquipe);
registrarView('tecnico',    renderTecnico);
registrarView('relatorios', renderRelatorios);

/* =========================================================
   3) Rede
   ========================================================= */
function atualizarRede(){
  const pill = document.getElementById('net-pill');
  const txt  = document.getElementById('netText');
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

/* =========================================================
   4) Relógio
   ========================================================= */
window.__utils = { turnoAtual, nowStr };

function tickClock(){
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = localStorage.getItem('tecnicoNome') || 'Técnico';
  document.getElementById('greetText').innerHTML =
    `${saud}, ${nome}.<span class="time">${turnoAtual()} · ${nowStr()}</span>`;
}
tickClock();
setInterval(tickClock, 30000);

/* =========================================================
   5) Nav
   ========================================================= */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.view));
});

/* =========================================================
   6) Esc
   ========================================================= */
document.addEventListener('keydown', e => {
  if(e.key === 'Escape'){
    closeModal();
    if(document.getElementById('qrOverlay').classList.contains('ativo')) fecharQR();
  }
});

/* =========================================================
   7) Aviso de saída
   ========================================================= */
window.addEventListener('beforeunload', e => {
  if(state.db.paradas.filter(p => p.status !== 'encerrada').length > 0){
    e.preventDefault();
    e.returnValue = '';
  }
});

/* =========================================================
   8) Eventos
   ========================================================= */
on('undo:aplicado', render);

/* =========================================================
   9) Expor para onclick inline
   ========================================================= */
Object.assign(window, {
  /* Radar */
  irParaRegistro, abrirAtender, abrirVoltou,
  abrirAssumir, confirmarAssumir, abrirEncerrar, irParaEncerramento, abrirCorrigir,

  /* Registro */
  salvarRegistro, cancelarRegistro, toggleDitado,
  onFoto, onVideo, toggleAudio, removerAnexoItem,

  /* Máquinas */
  abrirNovaMaquina, confirmarNovaMaquina, registrarParaMaquina,

  /* Equipe */
  abrirNovoTecnico, confirmarNovoTecnico,
  abrirEditarTecnico, confirmarEditarTecnico, confirmarDesativar,
  abrirDirecionar, confirmarDirecionar, limparFiltrosEquipe,

  /* Detalhe da parada */
  /* Detalhe da parada */
  
  abrirDetalheParada, abrirDetalheParadaPorId, abrirZoom, exportarParada,
  /* QR */
  abrirQR, fecharQR,

  /* Relatórios */
  exportarCSV, limparFiltrosRelatorios,

  /* UI geral */
  closeModal, desfazer, atualizarRede,

  /* helpers */
  __render: render
});

/* =========================================================
   10) Boot
   ========================================================= */
atualizarRede();
navigate('radar');