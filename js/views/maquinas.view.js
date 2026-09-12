/* =========================================================
   maquinas.view.js — lista agrupada por Setor → Área
   ========================================================= */

import { state, getMaquina, novoDraft } from '../core/state.js';
import { navigate } from '../core/router.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { criarMaquina } from '../services/maquinas.service.js';
import { fmtMin, escapeHtml } from '../core/utils.js';
import { SETORES } from '../data/constants.js';

let filtro = { busca: '', setor: '', status: '' };
let debounceTimer = null;

/* =========================================================
   RENDER
   ========================================================= */
export function renderMaquinas() {
  const todas = state.db.maquinas || [];
  
  // Debug: se estiver vazio, o admin saberá que o banco realmente não carregou
  if (todas.length === 0) {
    console.warn('[maquinas.view] state.db.maquinas está vazio. Verifique o carregamento do DB.');
  }

  const activeEl = document.activeElement;
  const isBuscaFocused = activeEl?.id === 'mBusca';
  const cursorPos = isBuscaFocused ? activeEl.selectionStart : 0;

  const setores = [...new Set(todas.map(m => m.setor).filter(Boolean))].sort();

  const filtradas = todas.filter(m => {
    if (filtro.setor && m.setor !== filtro.setor) return false;
    if (filtro.status && m.status !== filtro.status) return false;
    if (filtro.busca) {
      const q = filtro.busca.toLowerCase();
      const hay = [m.nome, m.setor, m.area, m.qr].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const agrupado = filtradas.reduce((acc, m) => {
    const s = m.setor || 'Sem setor';
    const a = m.area || '_';
    if (!acc[s]) acc[s] = { _tot: 0 };
    if (!acc[s][a]) acc[s][a] = [];
    acc[s][a].push(m);
    acc[s]._tot++;
    return acc;
  }, {});

  const setoresOrdenados = Object.keys(agrupado).sort();
  const isAdminOrSup = ['admin', 'supervisor'].includes(state.db.currentUser?.role);

  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Máquinas · ${filtradas.length} de ${todas.length}</h2>
      ${isAdminOrSup ? `<button class="action" onclick="abrirNovaMaquina()">+ Nova máquina</button>` : ''}
    </div>

    <div class="filtros-bar">
      <input type="search" id="mBusca" class="input-mini" placeholder="🔍 Buscar máquina, setor, área…" value="${escapeHtml(filtro.busca)}" autocomplete="off">
      <select class="input-mini" id="mSetor">
        <option value="">Setor: todos</option>
        ${setores.map(s => `<option ${filtro.setor === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
      </select>
      <select class="input-mini" id="mStatus">
        <option value="">Status: todos</option>
        <option value="operando" ${filtro.status === 'operando' ? 'selected' : ''}>Operando</option>
        <option value="parada" ${filtro.status === 'parada' ? 'selected' : ''}>Parada</option>
        <option value="manutencao" ${filtro.status === 'manutencao' ? 'selected' : ''}>Manutenção</option>
      </select>
      <button class="btn sm ghost" id="mLimpar" ${!filtro.busca && !filtro.setor && !filtro.status ? 'disabled' : ''}>Limpar</button>
    </div>

    ${todas.length === 0
      ? `<div class="empty" style="padding:40px 20px;">
           <b style="font-size:15px; display:block; margin-bottom:8px;">Nenhuma máquina no banco de dados</b>
           <span style="font-size:13px; color:var(--muted);">O admin pode adicionar a primeira máquina usando o botão acima (se visível) ou verifique o console (F12).</span>
         </div>`
      : filtradas.length === 0
      ? `<div class="empty" style="padding:40px 20px;">Nenhuma máquina corresponde aos filtros aplicados.</div>`
      : setoresOrdenados.map(setor => {
          const grupo = agrupado[setor];
          const areasKeys = Object.keys(grupo).filter(k => k !== '_tot').sort();

          return `
            <div class="setor-bloco">
              <div class="setor-head">
                <span class="setor-titulo">${escapeHtml(setor)}</span>
                <span class="setor-count">${grupo._tot}</span>
              </div>
              ${areasKeys.map(areaKey => {
                const lista = grupo[areaKey];
                const ehLivre = areaKey === '_';
                return `
                  <div class="area-bloco">
                    ${!ehLivre ? `<div class="area-titulo">${escapeHtml(areaKey)}</div>` : ''}
                    <div class="maq-grid">
                      ${lista.map(m => maquinaCardHTML(m)).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }).join('')
    }
  `;

  const busca = document.getElementById('mBusca');
  const selS = document.getElementById('mSetor');
  const selSt = document.getElementById('mStatus');
  const btnL = document.getElementById('mLimpar');

  busca?.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filtro.busca = e.target.value;
      renderMaquinas();
      const el = document.getElementById('mBusca');
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    }, 250);
  });

  selS?.addEventListener('change', e => { filtro.setor = e.target.value; renderMaquinas(); });
  selSt?.addEventListener('change', e => { filtro.status = e.target.value; renderMaquinas(); });
  
  btnL?.addEventListener('click', () => { 
    filtro = { busca: '', setor: '', status: '' }; 
    renderMaquinas(); 
  });
}

/* =========================================================
   CARD
   ========================================================= */
function maquinaCardHTML(m) {
  const parada = (state.db.paradas || []).find(p => p.maquinaId === m.id && p.status !== 'encerrada');
  
  // CORREÇÃO CRÍTICA: Aceita 'ok' (legado) ou 'operando' (padrão atual)
  const isOperando = m.status === 'operando' || m.status === 'ok';
  
  const classeEstado = isOperando ? 'is-operando' : 'is-parada';
  const textoEstado = isOperando ? 'OPERANDO' : 'PARADA';
  const badgeClass = isOperando ? 'ok' : 'parada';

  return `
    <div class="maq-card ${classeEstado}">
      <div class="maq-top">
        <div class="maq-nome" title="${escapeHtml(m.nome)}">${escapeHtml(m.nome)}</div>
        <span class="maq-badge ${badgeClass}">${textoEstado}</span>
      </div>

      <div class="maq-meta">
        <span>P${m.prioridade || '?'}</span>
        ${m.qr ? `<span>·</span><span class="maq-qr">${escapeHtml(m.qr)}</span>` : ''}
      </div>

      ${parada ? `
        <div class="maq-parada-info">
          <span>⏱</span> Parada há <b>${fmtMin(Date.now() - parada.horaInicio)}</b>
        </div>
      ` : ''}

      <div class="maq-actions">
        <button class="btn sm ghost" onclick="registrarParaMaquina('${m.id}')">Registrar</button>
        <button class="btn sm ghost" onclick="verHistoricoMaquina('${m.id}')">Histórico</button>
      </div>
    </div>
  `;
}

/* =========================================================
   AÇÕES
   ========================================================= */
export function registrarParaMaquina(id) {
  const m = getMaquina(id); 
  if (!m) return;
  
  state.draft = novoDraft();
  state.draft.maquinaId = m.id;
  state.draft.setor = m.setor;
  state.draft.area = m.area;
  state.draft.equipamentoBase = m.nome;
  state.draft.modo = 'novo';
  
  navigate('registro');
}

export function verHistoricoMaquina(id) {
  const m = getMaquina(id); 
  if (!m) return;
  
  const paradas = (state.db.paradas || [])
    .filter(p => p.maquinaId === id)
    .sort((a, b) => b.horaInicio - a.horaInicio)
    .slice(0, 20);

  const html = `
    <div class="hist-list">
      ${paradas.length === 0
        ? '<div class="empty" style="padding:20px; text-align:center; color:var(--muted);">Nenhuma parada registrada para esta máquina.</div>'
        : paradas.map(p => {
            const dataFormatada = new Date(p.horaInicio).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const desc = p.causaRaiz || p.categoria || 'Sem descrição';
            
            return `
              <div class="hist-item">
                <div class="hist-data">${dataFormatada}</div>
                <div class="hist-desc" title="${escapeHtml(desc)}">${escapeHtml(desc)}</div>
                <div class="hist-status ${p.status}">${p.status}</div>
              </div>
            `;
          }).join('')
      }
    </div>
  `;
  openModal('', '📋', `Histórico · ${m.nome}`, html);
}

export function abrirNovaMaquina() {
  const html = `
    <div class="field">
      <label>Nome *</label>
      <input id="nMaqNome" placeholder="Ex: Prensa 12" autocomplete="off">
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Setor *</label>
      <select id="nMaqSetor">
        <option value="">Selecione…</option>
        ${SETORES.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
      </select>
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Área (opcional)</label>
      <input id="nMaqArea" placeholder="Ex: Sala de Corte" autocomplete="off">
    </div>
    <div class="field" style="margin-top:12px;">
      <label>QR Code (opcional)</label>
      <input id="nMaqQR" placeholder="Ex: MQ-PRENSA-12" autocomplete="off">
    </div>
    <div class="field" style="margin-top:12px;">
      <label>Prioridade</label>
      <select id="nMaqPrio">
        <option value="1">P1 — Crítica</option>
        <option value="2" selected>P2 — Alta</option>
        <option value="3">P3 — Normal</option>
      </select>
    </div>

    <div style="display:flex; gap:10px; margin-top:18px;">
      <button class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn block primary" onclick="confirmarNovaMaquina()">Criar</button>
    </div>
  `;
  openModal('', '⚙️', 'Nova máquina', html);
  setTimeout(() => document.getElementById('nMaqNome')?.focus(), 60);
}

export async function confirmarNovaMaquina() {
  const nomeEl = document.getElementById('nMaqNome');
  const setorEl = document.getElementById('nMaqSetor');
  
  const nome = nomeEl.value.trim();
  const setor = setorEl.value;

  if (!nome) { toast('Informe o nome da máquina.', 'red'); nomeEl.focus(); return; }
  if (!setor) { toast('Selecione o setor.', 'red'); setorEl.focus(); return; }

  const btn = document.querySelector('#modal .btn.primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  try {
    await criarMaquina({
      nome,
      setor,
      area: document.getElementById('nMaqArea').value.trim() || null,
      qr_code: document.getElementById('nMaqQR').value.trim() || null,
      prioridade: parseInt(document.getElementById('nMaqPrio').value, 10)
    });
    closeModal();
    toast('Máquina cadastrada com sucesso', 'green');
    if (typeof window.__render === 'function') window.__render();
    else renderMaquinas();
  } catch (err) {
    toast(err.message || 'Erro ao cadastrar máquina', 'red');
    if (btn) { btn.disabled = false; btn.textContent = 'Criar'; }
  }
}