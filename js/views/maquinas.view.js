import { state, getMaquina } from '../core/state.js';
import { navigate } from '../core/router.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { criarMaquina } from '../services/maquinas.service.js';
import { novoDraft } from '../core/state.js';
import { fmtMin, escapeHtml } from '../core/utils.js';
import { SETORES } from '../data/constants.js';
import { optionsFrom } from '../components/form-fields.js';

export function renderMaquinas(){
  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Máquinas</h2>
      <button class="action" onclick="abrirNovaMaquina()">+ Nova máquina</button>
    </div>
    <div id="gridMaquinas" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:10px;"></div>
  `;

  const grid = document.getElementById('gridMaquinas');
  if(state.db.maquinas.length === 0){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">Nenhuma máquina cadastrada. Adicione a primeira.</div>`;
    return;
  }

  grid.innerHTML = state.db.maquinas.map(m => {
    const parada = state.db.paradas.find(p => p.maquinaId === m.id && p.status !== 'encerrada');
    return `
      <div class="card" style="border-left-color:${m.status === 'ok' ? 'var(--green)' : 'var(--red)'};">
        <div class="top">
          <div>
            <div class="title">${escapeHtml(m.nome)}</div>
            <div class="subtitle">${escapeHtml(m.setor)} · Prioridade P${m.prioridade}</div>
          </div>
          <span style="font-size:10px; padding:3px 8px; border-radius:20px; font-weight:800; letter-spacing:.04em;
            background:${m.status === 'ok' ? 'var(--green-dim)' : 'var(--red-dim)'};
            color:${m.status === 'ok' ? 'var(--green)' : 'var(--red)'};">
            ${m.status === 'ok' ? 'OPERANDO' : 'PARADA'}
          </span>
        </div>
        ${parada ? `<div class="subtitle" style="margin-top:6px;">Parada há ${fmtMin(Date.now() - parada.horaInicio)}</div>` : ''}
        <div class="actions">
          <button class="btn sm ghost" onclick="registrarParaMaquina('${m.id}')">Registrar parada</button>
        </div>
      </div>
    `;
  }).join('');
}

export function registrarParaMaquina(id){
  const m = getMaquina(id); if(!m) return;
  state.draft = novoDraft();
  navigate('registro');
  setTimeout(() => {
    const f = document.getElementById('fMaquina'); if(f) f.value = m.nome;
    const s = document.getElementById('fSetor');   if(s) s.value = m.setor;
  }, 30);
}

export function abrirNovaMaquina(){
  openModal('', '⚙️', 'Nova máquina', `
    <div class="field"><label>Nome</label><input id="nMaqNome" placeholder="Ex: Prensa 12"></div>
    <div class="field" style="margin-top:12px;"><label>Setor</label>
      <select id="nMaqSetor">${optionsFrom(SETORES)}</select>
    </div>
    <div class="field" style="margin-top:12px;"><label>Prioridade</label>
      <select id="nMaqPrio">
        <option value="1">P1 — Crítica</option>
        <option value="2" selected>P2 — Alta</option>
        <option value="3">P3 — Normal</option>
      </select>
    </div>
    <div style="display:flex; gap:10px; margin-top:8px;">
      <button class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn block primary" onclick="confirmarNovaMaquina()">Criar</button>
    </div>
  `);
}

export function confirmarNovaMaquina(){
  const nome = document.getElementById('nMaqNome').value.trim();
  if(!nome){ toast('Informe o nome.', 'red'); return; }
  const setor = document.getElementById('nMaqSetor').value;
  const prioridade = parseInt(document.getElementById('nMaqPrio').value, 10);
  criarMaquina({nome, setor, prioridade});
  closeModal();
  toast('Máquina cadastrada', 'green');
  window.__render?.();
}