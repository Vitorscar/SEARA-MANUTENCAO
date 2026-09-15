/* =========================================================
   radar.view.js — tela do funcionário
   Lista de paradas + 3 botões fixos no rodapé
   ========================================================= */

import { state, novoDraft, getMaquina } from '../core/state.js';
import { navigate }                    from '../core/router.js';
import { logout }                      from '../services/auth.service.js';
import { toast }                       from '../ui/toast.js';
import { fmtMin, escapeHtml }          from '../core/utils.js';

/* =========================================================
   RENDER
   ========================================================= */
export function renderRadar(){
  const user = state.db?.currentUser;
  const paradasAbertas = (state.db?.paradas || [])
    .filter(p => p.status !== 'encerrada')
    .sort((a,b) => a.horaInicio - b.horaInicio);

  const h = new Date().getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';

  document.getElementById('view').innerHTML = `
    <div class="radar-mobile">

      <!-- Cabeçalho informativo -->
      <div class="rm-header">
        <div class="rm-saudacao">${saudacao}, <b>${escapeHtml(user?.nome?.split(' ')[0] || '—')}</b>.</div>
        <div class="rm-turno">
          ${user?.chapa ? `Chapa ${escapeHtml(user.chapa)}` : ''}
          ${user?.turno ? ` · ${escapeHtml(user.turno)}` : ''}
        </div>
      </div>

      <!-- Lista de paradas -->
      <div class="rm-lista">
        <div class="rm-titulo">
          🟥 PARADAS AGORA
          <span class="rm-count">${paradasAbertas.length}</span>
        </div>

        ${paradasAbertas.length === 0
          ? `<div class="rm-vazio">
               <div class="rm-vazio-ic">✅</div>
               <div class="rm-vazio-txt">Nenhuma parada em aberto.</div>
               <div class="rm-vazio-sub">A fábrica está rodando limpa.</div>
             </div>`
          : paradasAbertas.map(p => paradaItemHTML(p)).join('')
        }
      </div>

      <!-- RODAPÉ FIXO: 3 botões -->
      <div class="rm-footer">
        <button type="button" class="rm-btn rm-btn-sec"
                onclick="radarRefresh()" title="Atualizar">📡</button>

        <button type="button" class="rm-btn rm-btn-main"
                onclick="radarRegistrar()">🚨 REGISTRAR</button>

        <button type="button" class="rm-btn rm-btn-sec rm-btn-sair"
                onclick="radarSair()" title="Sair">🚪</button>
      </div>

    </div>
  `;
}

/* =========================================================
   ITEM DE PARADA ABERTA
   ========================================================= */
function paradaItemHTML(p){
  const m = getMaquina(p.maquinaId);
  const cor = p.status === 'atendendo' ? 'sun'
            : nivel(p) === 'crit' ? 'red'
            : 'amber';
  const labelStatus = p.status === 'atendendo' ? 'Em atendimento' : 'Aguardando';

  return `
    <button class="rm-card ${cor}" onclick="radarAbrirParada('${p.id}')">
      <div class="rm-card-head">
        <span class="rm-card-dot ${cor}"></span>
        <span class="rm-card-nome">${escapeHtml(m?.nome || '—')}</span>
        <span class="rm-card-tempo">${fmtMin(Date.now() - p.horaInicio)}</span>
      </div>
      <div class="rm-card-meta">
        ${escapeHtml(p.setor || '')} · ${escapeHtml(labelStatus)}
        ${p.impacto === 'Crítico' ? ' · 🔴 Crítico' : ''}
      </div>
    </button>
  `;
}

function nivel(p){
  const m = Math.round((Date.now() - p.horaInicio) / 60000);
  return m >= 60 ? 'crit' : 'warn';
}

/* =========================================================
   AÇÕES (exportadas + expostas em window)
   ========================================================= */

/* ---------- Atualizar ---------- */
export function radarRefresh(){
  window.__render?.();
  toast('Atualizado');
}
window.radarRefresh = radarRefresh;

/* ---------- Registrar nova parada ---------- */
export function radarRegistrar(){
  state.draft = novoDraft();
  navigate('registro');
}
window.radarRegistrar = radarRegistrar;

/* ---------- Sair ---------- */
export function radarSair(){
  if(!confirm('Sair da conta?')) return;
  logout();
}
window.radarSair = radarSair;

/* ---------- Abrir/encerrar parada existente ---------- */
export function radarAbrirParada(id){
  state.draft = novoDraft();
  state.draft.paradaEditando = id;
  state.draft.modo = 'encerrar';
  navigate('registro');
}
window.radarAbrirParada = radarAbrirParada;