import { state, getMaquina, isAdmin, statusTecnico } from '../core/state.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { criarTecnico, atualizarTecnico, desativarTecnico,
         direcionarParaParada, getEstatisticasTecnico } from '../services/equipe.service.js';
import { escapeHtml, fmtMin } from '../core/utils.js';
import { ESPECIALIDADES, ROLES, TURNOS } from '../data/constants.js';
import { optionsFrom } from '../components/form-fields.js';

export function renderEquipe(){
  const filtros = state.filtros.equipe;
  const tecnicos = state.db.tecnicos.filter(t => {
    if(filtros.status && statusTecnico(t.id).status !== filtros.status) return false;
    if(filtros.especialidade && t.especialidade !== filtros.especialidade) return false;
    return t.ativo !== false;
  });

  document.getElementById('view').innerHTML = `
    <div class="section-head">
      <h2>Equipe</h2>
      ${isAdmin() ? `<button class="action" onclick="abrirNovoTecnico()">+ Novo funcionário</button>` : ''}
    </div>

    <div class="filtros-bar">
      <select id="fEqStatus" class="input-mini">
        <option value="">Status: todos</option>
        <option value="disponivel" ${filtros.status==='disponivel'?'selected':''}>Disponíveis</option>
        <option value="atendendo"  ${filtros.status==='atendendo'?'selected':''}>Atendendo</option>
      </select>
      <select id="fEqEsp" class="input-mini">
        <option value="">Especialidade: todas</option>
        ${optionsFrom(ESPECIALIDADES, filtros.especialidade)}
      </select>
      <button class="btn sm ghost" onclick="limparFiltrosEquipe()">Limpar</button>
    </div>

    <div class="equipe-grid" id="gridEquipe"></div>
  `;

  const grid = document.getElementById('gridEquipe');
  if(tecnicos.length === 0){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">Nenhum funcionário com esses filtros.</div>`;
    return;
  }

  grid.innerHTML = tecnicos.map(t => equipeCardHTML(t)).join('');

  document.getElementById('fEqStatus').onchange = e => {
    state.filtros.equipe.status = e.target.value;
    renderEquipe();
  };
  document.getElementById('fEqEsp').onchange = e => {
    state.filtros.equipe.especialidade = e.target.value;
    renderEquipe();
  };
}

function equipeCardHTML(t){
  const st = statusTecnico(t.id);
  const stats = getEstatisticasTecnico(t.id);
  const corStatus = st.status === 'atendendo' ? 'sun'
                  : st.status === 'disponivel' ? 'green' : 'muted';
  const labelStatus = st.status === 'atendendo' ? 'Atendendo'
                    : st.status === 'disponivel' ? 'Disponível' : 'Offline';
  const tempoDesde = st.desde ? fmtMin(Date.now() - st.desde) : '';

  return `
    <div class="equipe-card clickable" onclick="abrirTecnico('${t.id}')">
      <div class="eq-head">
        <div class="eq-avatar">${iniciais(t.nome)}</div>
        <div class="eq-info">
          <div class="eq-nome">${escapeHtml(t.nome)}</div>
          <div class="eq-sub">${escapeHtml(t.especialidade)} · ${escapeHtml(t.matricula||'')}${t.role==='admin'?' · <b style="color:var(--red)">ADM</b>':''}</div>
        </div>
        <span class="eq-status ${corStatus}">
          <span class="dot ${corStatus}"></span>${labelStatus}
        </span>
      </div>

      ${st.status === 'atendendo' ? `
        <div class="eq-assign">
          <div class="eq-assign-lbl">Atendendo agora</div>
          <div class="eq-assign-maq">
            <b>${escapeHtml(st.maquina || '—')}</b>
            <span class="eq-assign-time">${tempoDesde}</span>
          </div>
        </div>
      ` : `
        <div class="eq-assign vazio">
          <span style="color:var(--ink-soft); font-size:12px;">Sem tarefa atribuída</span>
        </div>
      `}

      <div class="eq-stats">
        <div class="eq-stat"><b>${stats.hoje}</b><span>hoje</span></div>
        <div class="eq-stat"><b>${stats.total}</b><span>total</span></div>
        <div class="eq-stat"><b>${stats.mttr ? stats.mttr+'m' : '—'}</b><span>MTTR</span></div>
      </div>

      <div class="eq-actions" onclick="event.stopPropagation()">
        <button class="btn sm sun" onclick="abrirDirecionar('${t.id}')">Direcionar</button>
        ${isAdmin() ? `<button class="btn sm ghost" onclick="abrirEditarTecnico('${t.id}')">Editar</button>` : ''}
      </div>
    </div>
  `;
}
function iniciais(nome){
  return nome.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
}

/* ---------- Modais ---------- */

export function abrirNovoTecnico(){
  openModal('', '👤', 'Novo funcionário', `
    <div class="field"><label>Nome completo</label><input id="ntNome" placeholder="Ex: Maria Souza"></div>
    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="field"><label>Matrícula</label><input id="ntMat" placeholder="T005"></div>
      <div class="field"><label>Especialidade</label>
        <select id="ntEsp">${optionsFrom(ESPECIALIDADES)}</select>
      </div>
    </div>
    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="field"><label>Turno</label>
        <select id="ntTurno">${optionsFrom(TURNOS)}</select>
      </div>
      <div class="field"><label>Perfil</label>
        <select id="ntRole">
          <option value="tecnico">Técnico</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn block primary" onclick="confirmarNovoTecnico()">Criar</button>
    </div>
  `);
}

export function confirmarNovoTecnico(){
  try{
    criarTecnico({
      nome:          document.getElementById('ntNome').value,
      matricula:     document.getElementById('ntMat').value.trim(),
      especialidade: document.getElementById('ntEsp').value,
      turno:         document.getElementById('ntTurno').value,
      role:          document.getElementById('ntRole').value
    });
    closeModal();
    toast('Funcionário cadastrado', 'green');
    window.__render?.();
  }catch(e){
    toast(e.message, 'red');
  }
}

export function abrirEditarTecnico(id){
  const t = state.db.tecnicos.find(x => x.id === id);
  if(!t) return;
  openModal('', '✏️', 'Editar funcionário', `
    <div class="field"><label>Nome</label><input id="etNome" value="${escapeHtml(t.nome)}"></div>
    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="field"><label>Matrícula</label><input id="etMat" value="${escapeHtml(t.matricula||'')}"></div>
      <div class="field"><label>Especialidade</label>
        <select id="etEsp">${optionsFrom(ESPECIALIDADES, t.especialidade)}</select>
      </div>
    </div>
    <div class="row-2" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="field"><label>Turno</label>
        <select id="etTurno">${optionsFrom(TURNOS, t.turno)}</select>
      </div>
      <div class="field"><label>Perfil</label>
        <select id="etRole">
          <option value="tecnico"    ${t.role==='tecnico'?'selected':''}>Técnico</option>
          <option value="supervisor" ${t.role==='supervisor'?'selected':''}>Supervisor</option>
          <option value="admin"      ${t.role==='admin'?'selected':''}>Administrador</option>
        </select>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:14px;">
      <button class="btn block ghost" style="color:var(--red);" onclick="confirmarDesativar('${id}')">Desativar</button>
      <button class="btn block primary" onclick="confirmarEditarTecnico('${id}')">Salvar</button>
    </div>
  `);
}

export function confirmarEditarTecnico(id){
  atualizarTecnico(id, {
    nome:          document.getElementById('etNome').value.trim(),
    matricula:     document.getElementById('etMat').value.trim(),
    especialidade: document.getElementById('etEsp').value,
    turno:         document.getElementById('etTurno').value,
    role:          document.getElementById('etRole').value
  });
  closeModal();
  toast('Funcionário atualizado', 'green');
  window.__render?.();
}

export function confirmarDesativar(id){
  if(!confirm('Desativar este funcionário?')) return;
  desativarTecnico(id);
  closeModal();
  toast('Funcionário desativado', 'amber');
  window.__render?.();
}

export function abrirDirecionar(tecnicoId){
  const t = state.db.tecnicos.find(x => x.id === tecnicoId);
  const abertas = state.db.paradas.filter(p => p.status === 'aguardando');
  if(abertas.length === 0){
    toast('Nenhuma parada aguardando.', 'green');
    return;
  }
  const html = `
    <p style="font-size:13px; color:var(--ink-soft); margin-bottom:12px;">
      Escolha para qual parada direcionar <b>${escapeHtml(t.nome)}</b>:
    </p>
    ${abertas.map(p => {
      const m = getMaquina(p.maquinaId);
      return `
        <button class="card" style="text-align:left; cursor:pointer; border:none; width:100%; font-family:inherit; padding:14px; margin-bottom:10px; border-left:4px solid var(--red); background:var(--panel);" onclick="confirmarDirecionar('${tecnicoId}','${p.id}')">
          <div class="top">
            <div>
              <div class="title">#${p.numero} · ${escapeHtml(m?.nome || '—')}</div>
              <div class="subtitle">${escapeHtml(p.setor)} · parada há ${fmtMin(Date.now() - p.horaInicio)}</div>
            </div>
          </div>
        </button>
      `;
    }).join('')}
  `;
  openModal('amarelo', '🎯', 'Direcionar técnico', html);
}

export function confirmarDirecionar(tecnicoId, paradaId){
  direcionarParaParada(tecnicoId, paradaId);
  closeModal();
  toast('Técnico direcionado', 'green');
  window.__render?.();
}

export function limparFiltrosEquipe(){
  state.filtros.equipe = { status:'', especialidade:'' };
  renderEquipe();
}