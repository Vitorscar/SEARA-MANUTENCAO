/* =========================================================
   equipe.view.js — gestão de funcionários e direcionamento
   ========================================================= */

import { state, getMaquina, statusTecnico, usuarioEAdmin } from '../core/state.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { escapeHtml, fmtMin } from '../core/utils.js';
import { ESPECIALIDADES } from '../data/constants.js';

import {
  criarTecnico,
  atualizarTecnico,
  desativarTecnico,
  reativarTecnico,
  direcionarParaParada,
  direcionarTecnicos,
  getEstatisticasTecnico
} from '../services/equipe.service.js';

/* =========================================================
   VIEW PRINCIPAL
   ========================================================= */
export function renderEquipe(){
  const filtros = state.filtros?.equipe || { status:'', especialidade:'' };
  const todos = (state.db.tecnicos || []);

  /* ---------- Filtro ---------- */
  const tecnicos = todos.filter(t => {
    if(filtros.status){
      const st = statusTecnico(t.id);
      if(filtros.status === 'inativo'){
        if(t.ativo !== false) return false;
      } else {
        if(t.ativo === false) return false;
        if(st.status !== filtros.status) return false;
      }
    }
    if(filtros.especialidade && t.especialidade !== filtros.especialidade) return false;
    if(!filtros.status && t.ativo === false) return false;
    return true;
  });

  /* ---------- Ordena: quem pode ser direcionado primeiro ---------- */
  const ordem = {
    atendendo:          0,
    disponivel:         1,
    turno_nao_iniciado: 2,
    turno_encerrado:    3,
    offline:            4
  };
  tecnicos.sort((a, b) => {
    const sa = statusTecnico(a.id).status;
    const sb = statusTecnico(b.id).status;
    return (ordem[sa] ?? 9) - (ordem[sb] ?? 9);
  });

  const total = todos.filter(t => t.ativo !== false).length;

  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Equipe · ${total} ativo${total !== 1 ? 's' : ''}</h2>
      ${usuarioEAdmin() ? `<button class="action" onclick="abrirNovoTecnico()">+ Novo funcionário</button>` : ''}
    </div>

    <div class="filtros-bar">
      <select class="input-mini" id="fEqStatus">
        <option value="">Status: todos</option>
        <option value="disponivel"         ${filtros.status==='disponivel'?'selected':''}>🟢 Disponíveis</option>
        <option value="atendendo"          ${filtros.status==='atendendo'?'selected':''}>🟡 Atendendo</option>
        <option value="turno_encerrado"    ${filtros.status==='turno_encerrado'?'selected':''}>🔴 Turno encerrado</option>
        <option value="turno_nao_iniciado" ${filtros.status==='turno_nao_iniciado'?'selected':''}>⚪ Fora do turno</option>
        <option value="inativo"            ${filtros.status==='inativo'?'selected':''}>⚫ Inativos</option>
      </select>

      <select class="input-mini" id="fEqEsp">
        <option value="">Especialidade: todas</option>
        ${ESPECIALIDADES.map(e =>
          `<option ${filtros.especialidade===e?'selected':''}>${e}</option>`
        ).join('')}
      </select>

      <button class="btn sm ghost" onclick="limparFiltrosEquipe()">Limpar</button>
    </div>

    ${todos.length === 0
      ? `<div class="empty" style="padding:40px 20px;">
           <b style="font-size:15px; display:block; margin-bottom:8px;">Nenhum funcionário cadastrado</b>
           <span style="font-size:13px;">Clique em <b>+ Novo funcionário</b> para começar.</span>
         </div>`
      : `<div class="equipe-grid" id="gridEquipe">
           ${tecnicos.length === 0
             ? `<div class="empty" style="grid-column:1/-1;">Nenhum funcionário com esses filtros.</div>`
             : tecnicos.map(t => equipeCardHTML(t)).join('')
           }
         </div>`
    }
  `;

  const selStatus = document.getElementById('fEqStatus');
  const selEsp    = document.getElementById('fEqEsp');

  selStatus.onchange = e => {
    state.filtros = state.filtros || {};
    state.filtros.equipe = { ...(state.filtros.equipe || {}), status: e.target.value };
    renderEquipe();
  };
  selEsp.onchange = e => {
    state.filtros = state.filtros || {};
    state.filtros.equipe = { ...(state.filtros.equipe || {}), especialidade: e.target.value };
    renderEquipe();
  };
}

/* =========================================================
   CARD DO FUNCIONÁRIO
   ========================================================= */
function equipeCardHTML(t){
  const st = statusTecnico(t.id);
  const stats = getEstatisticasTecnico(t.id);
  const inativo = t.ativo === false;

  /* ---------- Mapeia status → cor + label ---------- */
  const mapa = {
    atendendo:          { cor:'sun',   label:'Atendendo',       icone:'🟡' },
    disponivel:         { cor:'green', label:'Disponível',      icone:'🟢' },
    turno_encerrado:    { cor:'muted', label:'Turno encerrado', icone:'🔴' },
    turno_nao_iniciado: { cor:'muted', label:'Fora do turno',   icone:'⚪' },
    offline:            { cor:'muted', label:'Offline',         icone:'⚫' }
  };

  const s = inativo
    ? { cor:'muted', label:'Inativo', icone:'⚫' }
    : (mapa[st.status] || mapa.offline);

  const podeDirecionar = !inativo && st.status === 'disponivel';
  const emAtendimento  = !inativo && st.status === 'atendendo';
  const tempoDesde = st.desde ? fmtMin(Date.now() - st.desde) : '';
  const chapa = t.chapa || t.matricula || '—';

  /* ---------- Bloco do meio (varia por estado) ---------- */
  let blocoInfo = '';
  if(emAtendimento){
    blocoInfo = `
      <div class="eq-assign">
        <div class="eq-assign-lbl">Atendendo agora</div>
        <div class="eq-assign-maq">
          <b>${escapeHtml(st.maquina || '—')}</b>
          <span class="eq-assign-time">${tempoDesde}</span>
        </div>
      </div>
    `;
  } else if(st.status === 'turno_encerrado'){
    blocoInfo = `
      <div class="eq-assign turno-fechado">
        <div class="eq-assign-lbl">${s.icone} ${s.label}</div>
        <div class="eq-assign-sub">Turno ${escapeHtml(t.turno || '—')} não está ativo no momento.</div>
      </div>
    `;
  } else if(st.status === 'turno_nao_iniciado'){
    blocoInfo = `
      <div class="eq-assign turno-fechado">
        <div class="eq-assign-lbl">${s.icone} ${s.label}</div>
        <div class="eq-assign-sub">Turno ${escapeHtml(t.turno || '—')} ainda não começou.</div>
      </div>
    `;
  } else if(inativo){
    blocoInfo = `
      <div class="eq-assign turno-fechado">
        <div class="eq-assign-sub">Funcionário inativo — sem acesso ao sistema.</div>
      </div>
    `;
  } else {
    blocoInfo = `
      <div class="eq-assign vazio">
        <span style="color:var(--ink-soft); font-size:12px;">Sem tarefa atribuída</span>
      </div>
    `;
  }

  return `
    <div class="equipe-card clickable ${inativo ? 'inativo' : ''}"
         onclick="${inativo ? '' : `abrirTecnico('${t.id}')`}">
      <div class="eq-head">
        <div class="eq-avatar">${iniciais(t.nome)}</div>
        <div class="eq-info">
          <div class="eq-nome">${escapeHtml(t.nome)}</div>
          <div class="eq-sub">
            Chapa ${escapeHtml(chapa)} · ${escapeHtml(t.especialidade || '—')}
            ${t.turno ? ` · <b>${escapeHtml(t.turno)}</b>` : ''}
            ${t.role === 'admin' ? ' · <b style="color:var(--red)">ADM</b>' : ''}
          </div>
        </div>
        <span class="eq-status ${s.cor}">
          <span class="dot ${s.cor}"></span>${s.label}
        </span>
      </div>

      ${blocoInfo}

      <div class="eq-stats">
        <div class="eq-stat"><b>${stats.hoje}</b><span>hoje</span></div>
        <div class="eq-stat"><b>${stats.total}</b><span>total</span></div>
        <div class="eq-stat"><b>${stats.mttr ? stats.mttr+'m' : '—'}</b><span>MTTR</span></div>
      </div>

      <div class="eq-actions" onclick="event.stopPropagation()">
        ${podeDirecionar
          ? `<button class="btn sm sun" onclick="abrirDirecionar('${t.id}')">Direcionar</button>`
          : `<button class="btn sm ghost" disabled title="Funcionário fora do turno ativo" style="opacity:.5; cursor:not-allowed;">Direcionar</button>`
        }
        ${usuarioEAdmin() ? `<button class="btn sm ghost" onclick="abrirEditarTecnico('${t.id}')">Editar</button>` : ''}
      </div>
    </div>
  `;
}

function iniciais(nome){
  return String(nome || '?')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* =========================================================
   CRIAR FUNCIONÁRIO
   ========================================================= */
export function abrirNovoTecnico(){
  openModal('', '👤', 'Cadastrar funcionário', `
    <div class="field">
      <label>Nome completo *</label>
      <input id="ntNome" type="text" placeholder="Ex: João da Silva Santos" autocomplete="off" maxlength="80">
    </div>

    <div class="field" style="margin-top:14px;">
      <label>Número da chapa *</label>
      <input id="ntChapa" type="text" class="chapa-input-modal" inputmode="numeric" maxlength="9" placeholder="000000000" autocomplete="off">
      <small class="chapa-hint">9 dígitos numéricos</small>
    </div>

    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px;">
      <div class="field">
        <label>Turno *</label>
        <select id="ntTurno">
          <option value="">Selecione…</option>
          <option value="1º Turno">1º Turno (06:00 – 14:00)</option>
          <option value="2º Turno">2º Turno (14:00 – 22:00)</option>
          <option value="3º Turno">3º Turno (22:00 – 06:00)</option>
        </select>
      </div>
      <div class="field">
        <label>Especialidade</label>
        <select id="ntEsp">
          <option>Multifuncional</option>
          <option>Mecânica</option>
          <option>Elétrica</option>
          <option>Hidráulica</option>
          <option>Automação</option>
          <option>Refrigeração</option>
          <option>Civil</option>
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:14px;">
      <label>Perfil de acesso</label>
      <select id="ntRole">
        <option value="tecnico">Técnico</option>
        <option value="supervisor">Supervisor</option>
        <option value="admin">Administrador</option>
      </select>
    </div>

    <p id="ntErro" class="form-erro hidden"></p>

    <div style="display:flex; gap:10px; margin-top:18px;">
      <button type="button" class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn block primary" onclick="confirmarNovoTecnico()">Cadastrar</button>
    </div>
  `);

  const chapa = document.getElementById('ntChapa');
  chapa.addEventListener('input', () => {
    chapa.value = chapa.value.replace(/\D/g, '').slice(0, 9);
    const hint = chapa.parentElement.querySelector('.chapa-hint');
    if(!hint) return;
    if(chapa.value.length === 9){
      hint.textContent = '✓ Chapa válida';
      hint.style.color = 'var(--green)';
    } else {
      hint.textContent = `${chapa.value.length}/9 dígitos`;
      hint.style.color = 'var(--muted-2)';
    }
  });

  setTimeout(() => document.getElementById('ntNome')?.focus(), 60);
}

export async function confirmarNovoTecnico(){
  const erro = document.getElementById('ntErro');
  erro.classList.add('hidden');

  try {
    const t = await criarTecnico({
      nome:          document.getElementById('ntNome').value,
      chapa:         document.getElementById('ntChapa').value,
      turno:         document.getElementById('ntTurno').value,
      especialidade: document.getElementById('ntEsp').value,
      role:          document.getElementById('ntRole').value
    });

    closeModal();
    toast(`${t.nome.split(' ')[0]} cadastrado(a) · chapa ${t.chapa}`, 'green');
    window.__render?.();
  } catch(err){
    erro.textContent = err.message;
    erro.classList.remove('hidden');
  }
}

/* =========================================================
   EDITAR FUNCIONÁRIO
   ========================================================= */
export function abrirEditarTecnico(id){
  const t = (state.db.tecnicos || []).find(x => x.id === id);
  if(!t) return;

  const inativo = t.ativo === false;

  openModal('', '✏️', 'Editar funcionário', `
    <div class="field">
      <label>Nome completo</label>
      <input id="etNome" type="text" value="${escapeHtml(t.nome)}" maxlength="80">
    </div>

    <div class="field" style="margin-top:14px;">
      <label>Número da chapa</label>
      <input id="etChapa" type="text" class="chapa-input-modal" inputmode="numeric" maxlength="9" value="${escapeHtml(t.chapa || '')}">
      <small class="chapa-hint">9 dígitos numéricos</small>
    </div>

    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px;">
      <div class="field">
        <label>Turno</label>
        <select id="etTurno">
          ${['1º Turno','2º Turno','3º Turno'].map(x =>
            `<option ${t.turno === x ? 'selected' : ''}>${x}</option>`
          ).join('')}
        </select>
      </div>
      <div class="field">
        <label>Especialidade</label>
        <select id="etEsp">
          ${['Multifuncional','Mecânica','Elétrica','Hidráulica','Automação','Refrigeração','Civil'].map(x =>
            `<option ${t.especialidade === x ? 'selected' : ''}>${x}</option>`
          ).join('')}
        </select>
      </div>
    </div>

    <div class="field" style="margin-top:14px;">
      <label>Perfil</label>
      <select id="etRole">
        <option value="tecnico"    ${t.role==='tecnico'?'selected':''}>Técnico</option>
        <option value="supervisor" ${t.role==='supervisor'?'selected':''}>Supervisor</option>
        <option value="admin"      ${t.role==='admin'?'selected':''}>Administrador</option>
      </select>
    </div>

    <p id="etErro" class="form-erro hidden"></p>

    <div style="display:flex; gap:10px; margin-top:18px;">
      <button class="btn block ghost" style="color:${inativo ? 'var(--green)' : 'var(--red)'};"
              onclick="confirmarDesativar('${id}')">
        ${inativo ? 'Reativar' : 'Desativar'}
      </button>
      <button class="btn block primary" onclick="confirmarEditarTecnico('${id}')">Salvar</button>
    </div>
  `);

  const chapa = document.getElementById('etChapa');
  chapa.addEventListener('input', () => {
    chapa.value = chapa.value.replace(/\D/g, '').slice(0, 9);
  });
}

export function confirmarEditarTecnico(id){
  const erro = document.getElementById('etErro');
  erro.classList.add('hidden');

  try {
    atualizarTecnico(id, {
      nome:          document.getElementById('etNome').value.trim(),
      chapa:         document.getElementById('etChapa').value,
      turno:         document.getElementById('etTurno').value,
      especialidade: document.getElementById('etEsp').value,
      role:          document.getElementById('etRole').value
    });
    closeModal();
    toast('Funcionário atualizado', 'green');
    window.__render?.();
  } catch(err){
    erro.textContent = err.message;
    erro.classList.remove('hidden');
  }
}

export function confirmarDesativar(id){
  const t = (state.db.tecnicos || []).find(x => x.id === id);
  if(!t) return;

  if(t.ativo === false){
    reativarTecnico(id);
    toast(`${t.nome.split(' ')[0]} reativado(a)`, 'green');
    closeModal();
    window.__render?.();
  } else {
    if(!confirm(`Desativar ${t.nome}?\n\nEle(a) não conseguirá mais fazer login.`)) return;
    desativarTecnico(id);
    toast(`${t.nome.split(' ')[0]} desativado(a)`, 'amber');
    closeModal();
    window.__render?.();
  }
}

/* =========================================================
   DIRECIONAR (multi-técnico + validação de turno)
   ========================================================= */
export function abrirDirecionar(tecnicoId = null){
  /* ⛔ Se veio de um card específico, valida turno dele */
  if(tecnicoId){
    const t = (state.db.tecnicos || []).find(x => x.id === tecnicoId);
    if(!t) return;
    const st = statusTecnico(tecnicoId);
    if(st.status !== 'disponivel'){
      const msgs = {
        atendendo:          `${t.nome.split(' ')[0]} já está atendendo outra máquina.`,
        turno_encerrado:    `${t.nome.split(' ')[0]} já encerrou o turno de hoje.`,
        turno_nao_iniciado: `${t.nome.split(' ')[0]} ainda não iniciou o turno.`,
        offline:            `${t.nome.split(' ')[0]} está offline.`
      };
      toast(msgs[st.status] || 'Funcionário indisponível.', 'amber');
      return;
    }
  }

  /* Só mostra técnicos disponíveis OU o pré-selecionado */
  const todos = (state.db.tecnicos || []).filter(t => t.ativo !== false);
  const disponiveis = todos.filter(t => {
    const st = statusTecnico(t.id);
    return st.status === 'disponivel';
  });

  const maquinas = state.db.maquinas || [];
  const paradasAbertas = (state.db.paradas || []).filter(p => p.status === 'aguardando');

  const preMarcados = tecnicoId ? [tecnicoId] : [];

  openModal('amarelo', '🎯', 'Direcionar equipe', `
    <div class="field">
      <label>Máquina *</label>
      <input type="text" id="dirMaquinaBusca" list="dirMaquinas" placeholder="Digite para filtrar…" autocomplete="off">
      <datalist id="dirMaquinas">
        ${maquinas.map(m =>
          `<option data-id="${m.id}" value="${m.nome} (${m.setor}${m.area?' · '+m.area:''})">`
        ).join('')}
      </datalist>
    </div>

    <div class="field" style="margin-top:12px;">
      <label>Parada aberta (opcional)</label>
      <select id="dirParada">
        <option value="">— Sem parada vinculada (apenas registro de OS) —</option>
        ${paradasAbertas.map(p =>
          `<option value="${p.id}">#${p.numero} · ${p.maquinaNome || p.setor}</option>`
        ).join('')}
      </select>
    </div>

    <div class="field" style="margin-top:12px;">
      <label>Técnicos * <small style="color:var(--muted); font-weight:500;">(1 ou mais — forma um time)</small></label>
      ${disponiveis.length === 0
        ? `<div class="empty" style="padding:14px; font-size:12px;">Nenhum técnico disponível no turno atual.</div>`
        : `<div class="dir-tecnicos">
             ${disponiveis.map(t => `
               <label class="dir-tec">
                 <input type="checkbox" value="${t.id}" ${preMarcados.includes(t.id) ? 'checked' : ''}>
                 <span>${t.nome.split(' ')[0]}</span>
                 <small>${t.especialidade || 'Geral'} · ${t.turno || '—'}</small>
               </label>
             `).join('')}
           </div>`
      }
    </div>

    <div class="field" style="margin-top:12px;">
      <label>Observação (opcional)</label>
      <textarea id="dirObs" placeholder="Ex: levar chave 17, verificar pressão…" rows="2" style="width:100%; resize:vertical;"></textarea>
    </div>

    <p id="dirErro" class="form-erro hidden"></p>

    <div style="display:flex; gap:10px; margin-top:16px;">
      <button type="button" class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn block sun" onclick="confirmarDirecionar()">Enviar direcionamento</button>
    </div>
  `);

  setTimeout(() => document.getElementById('dirMaquinaBusca')?.focus(), 60);
}

export async function confirmarDirecionar(){
  const erro = document.getElementById('dirErro');
  erro.classList.add('hidden');

  try {
    /* Resolve máquina pelo texto do datalist */
    const busca = document.getElementById('dirMaquinaBusca');
    const nomeBusca = busca.value.trim();
    const lista = document.getElementById('dirMaquinas').options;
    let maquinaId = null;
    for(const opt of lista){
      if(opt.value === nomeBusca){ maquinaId = opt.dataset.id; break; }
    }
    if(!maquinaId) throw new Error('Selecione uma máquina válida da lista.');

    /* Técnicos selecionados */
    const tecnicoIds = [...document.querySelectorAll('.dir-tec input:checked')].map(x => x.value);
    if(tecnicoIds.length === 0) throw new Error('Selecione pelo menos um técnico.');

    const paradaId = document.getElementById('dirParada').value || null;
    const observacao = document.getElementById('dirObs').value.trim();

    await direcionarTecnicos({ maquinaId, tecnicoIds, paradaId, observacao });

    closeModal();
    toast(`Direcionamento enviado · ${tecnicoIds.length} técnico(s) notificado(s)`, 'green');
    window.__render?.();
  } catch(err){
    erro.textContent = err.message;
    erro.classList.remove('hidden');
  }
}

/* =========================================================
   FILTROS
   ========================================================= */
export function limparFiltrosEquipe(){
  state.filtros = state.filtros || {};
  state.filtros.equipe = { status:'', especialidade:'' };
  renderEquipe();
}