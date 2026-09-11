import { state, novoDraft, getMaquina, getTecnico } from '../core/state.js';
import { navigate } from '../core/router.js';
import { chipStatus } from '../components/chip-status.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { registrarDesfazer } from '../ui/undo.js';
import { assumirParada } from '../services/paradas.service.js';
import { alertaCritico } from '../services/audio.service.js';
import { fmtMin, fmtDuracaoMin, escapeHtml, minutosDesde, impactoCor } from '../core/utils.js';

export function renderRadar(){
  const paradasAbertas = state.db.paradas.filter(p => p.status !== 'encerrada');
  const criticas  = paradasAbertas.filter(p => nivel(p) === 'crit');
  const atendendo = paradasAbertas.filter(p => p.status === 'atendendo');
  const totalMinHoje = paradasAbertas.reduce((s,p) => s + minutosDesde(p.horaInicio), 0);

  const hoje = new Date().toISOString().slice(0,10);
  const encerradasHoje = state.db.paradas.filter(p =>
    p.status === 'encerrada' && p.horaFim &&
    new Date(p.horaFim).toISOString().slice(0,10) === hoje
  );
  const mttr = encerradasHoje.length
    ? Math.round(encerradasHoje.reduce((s,p) => s + p.duracaoMin, 0) / encerradasHoje.length)
    : null;

  /* ---------- Lista unificada: todas as máquinas ---------- */
  // Ordem: paradas críticas → paradas warn → atendendo → operando
  const maquinasOrdenadas = [...state.db.maquinas].sort((a,b) => {
    const pa = paradasAbertas.find(p => p.maquinaId === a.id);
    const pb = paradasAbertas.find(p => p.maquinaId === b.id);
    const scoreA = pa ? (nivel(pa) === 'crit' ? 0 : pa.status === 'atendendo' ? 2 : 1) : 3;
    const scoreB = pb ? (nivel(pb) === 'crit' ? 0 : pb.status === 'atendendo' ? 2 : 1) : 3;
    return scoreA - scoreB;
  });

  document.getElementById('view').innerHTML = `
    <div class="status-row">
      ${chipStatus({ cor:'red',   valor:criticas.length,  label:'Críticas' })}
      ${chipStatus({ cor:'sun',   valor:atendendo.length, label:'Atendendo' })}
      ${chipStatus({ cor:'amber', valor:totalMinHoje,     label:'Min hoje' })}
      ${chipStatus({ cor:'green', valor:mttr ? mttr+'m' : '—', label:'MTTR' })}
    </div>

    <div class="big-actions">
      <button class="big-btn big-parou" onclick="irParaRegistro()">
        <div class="left">
          <div class="icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div class="txt">PAROU<small>Registrar nova parada de máquina</small></div>
        </div>
      </button>
      <button class="big-btn big-atender" onclick="abrirAtender()">
        <div class="left">
          <div class="icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          </div>
          <div class="txt">ATENDER<small>Assumir parada aguardando</small></div>
        </div>
        <span class="cnt">${state.db.paradas.filter(p => p.status === 'aguardando').length}</span>
      </button>
      <button class="big-btn big-voltou" onclick="abrirVoltou()">
        <div class="left">
          <div class="icon-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <div class="txt">VOLTOU<small>Encerrar parada em andamento</small></div>
        </div>
        <span class="cnt">${atendendo.length}</span>
      </button>
    </div>

    <div class="section-head">
      <h2>Máquinas na linha</h2>
      <span style="font-size:12px; color:var(--muted); font-weight:700;">${maquinasOrdenadas.length} máquinas</span>
    </div>
    <div id="listaMaquinasRadar" class="radar-grid"></div>
  `;

  document.getElementById('listaMaquinasRadar').innerHTML =
    maquinasOrdenadas.map(m => maquinaCardHTML(m, paradasAbertas.find(p => p.maquinaId === m.id))).join('');
  bindMaquinaActions();
}

function nivel(p){
  const m = minutosDesde(p.horaInicio);
  if(m >= 60) return 'crit';
  if(m >= 30) return 'warn';
  return 'ok';
}

/* ---------- Card unificado ---------- */
function maquinaCardHTML(m, parada){
  // Máquina operando
  if(!parada){
    return `
      <div class="mc mc-operando">
        <div class="mc-head">
          <div class="mc-name">
            <span class="mc-dot operando"></span>
            <span>${escapeHtml(m.nome)}</span>
          </div>
          <span class="mc-badge prio-${m.prioridade}">P${m.prioridade}</span>
        </div>
        <div class="mc-body">
          <div class="mc-line">${escapeHtml(m.setor)} · Operando normalmente</div>
        </div>
      </div>
    `;
  }

  // Máquina com parada ativa
  const niv = nivel(parada);
  const t = parada.tecnicoId ? getTecnico(parada.tecnicoId) : null;
  const clsStatus = parada.status === 'atendendo' ? 'atendendo'
                  : niv === 'crit' ? 'crit'
                  : niv === 'warn' ? 'warn' : 'ok';
  const corDot = clsStatus === 'atendendo' ? 'sun'
               : clsStatus === 'crit' ? 'red'
               : clsStatus === 'warn' ? 'amber' : 'red';
  const descricao = parada.causaRaiz || parada.descricao || parada.categoria || 'Sem descrição';
  const techLabel = parada.status === 'atendendo'
    ? `Em atendimento · ${t?.nome || '—'}`
    : 'Aguardando técnico';

  return `
    <div class="mc mc-parada mc-${clsStatus}">
      <div class="mc-head">
        <div class="mc-name">
          <span class="mc-dot ${corDot}"></span>
          <span>${escapeHtml(m.nome)}</span>
        </div>
        <div class="mc-tempo">
          <span class="mc-tempo-lbl">parada há</span>
          <span class="mc-tempo-val">${fmtMin(Date.now() - parada.horaInicio)}</span>
        </div>
      </div>

      <div class="mc-body">
        <div class="mc-line">${escapeHtml(m.setor)} · ${escapeHtml(descricao)}</div>
        <div class="mc-meta">
          <span class="mc-tech">${escapeHtml(techLabel)}</span>
          <span class="mc-impacto" style="color:${impactoCor(parada.impacto)}">${parada.impacto}</span>
        </div>
      </div>

      <div class="mc-foot">
        <span class="mc-badge prio-${m.prioridade}">P${m.prioridade}</span>
        <div class="mc-actions">
          ${parada.status === 'aguardando' ? `<button class="btn sm sun" data-radar-act="assumir" data-id="${parada.id}">Assumir</button>` : ''}
          <button class="btn sm primary" data-radar-act="encerrar" data-id="${parada.id}">Encerrar</button>
          <button class="btn sm ghost" data-radar-act="cobrar" data-id="${parada.id}">Cobrar</button>
        </div>
      </div>
    </div>
  `;
}

function bindMaquinaActions(){
  document.querySelectorAll('[data-radar-act]').forEach(btn => {
    btn.onclick = () => {
      const p = state.db.paradas.find(x => x.id === btn.dataset.id);
      if(!p) return;
      const act = btn.dataset.radarAct;
      if(act === 'assumir')  abrirAssumir(p);
      if(act === 'encerrar') abrirEncerrar(p);
      if(act === 'cobrar')   toast('Cobrança enviada ao responsável.', 'amber');
    };
  });
}

/* ============ Modais (mesma API do arquivo anterior) ============ */

export function irParaRegistro(){
  state.draft = novoDraft();
  navigate('registro');
}

export function abrirAssumir(p){
  const m = getMaquina(p.maquinaId);
  const opts = state.db.tecnicos
    .filter(t => t.ativo !== false)
    .map(t => `<option value="${t.id}">${t.nome} — ${t.especialidade}</option>`)
    .join('');
  openModal('amarelo', '🟡', `Assumir — ${m?.nome || ''}`, `
    <div class="field"><label>Técnico responsável</label><select id="mTecnico">${opts}</select></div>
    <div style="display:flex; gap:10px; margin-top:8px;">
      <button class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn block sun" onclick="confirmarAssumir('${p.id}')">Confirmar</button>
    </div>
  `);
}

export function confirmarAssumir(id){
  const tecnicoId = document.getElementById('mTecnico').value;
  const res = assumirParada(id, tecnicoId);
  if(!res) return;
  closeModal();
  toast('Parada em atendimento', 'green');
  registrarDesfazer('Atendimento iniciado', () => {
    res.parada.status = res.antes.status;
    res.parada.tecnicoId = res.antes.tecnicoId;
    if(res.os){ res.os.coluna = 'fila'; res.os.tecnicoId = null; }
  });
  window.__render?.();
}

export function abrirEncerrar(p){
  const m = getMaquina(p.maquinaId);
  const dur = minutosDesde(p.horaInicio);
  openModal('verde', '🟢', `Encerrar parada #${p.numero}`, `
    <div style="background:var(--panel-2); border:1px solid var(--border); border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; margin-bottom:14px;">
      <b>${escapeHtml(m?.nome || '—')}</b> · ${escapeHtml(p.setor)} · ${escapeHtml(p.turno)}<br>
      Início: ${new Date(p.horaInicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · Duração: <b style="color:var(--red);">${fmtDuracaoMin(dur)}</b>
    </div>
    <p style="font-size:12.5px; color:var(--muted); margin-bottom:10px;">Para finalizar, complete a ficha no formulário completo:</p>
    <div style="display:flex; gap:10px;">
      <button class="btn block ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn block green" onclick="irParaEncerramento('${p.id}')">Abrir ficha completa</button>
    </div>
  `);
}

export function irParaEncerramento(id){
  closeModal();
  const p = state.db.paradas.find(x => x.id === id);
  state.draft = {
    categoria: p?.categoria || null,
    subcausa:  p?.subcausa  || null,
    acaoComponente: p?.acaoComponente || null,
    acaoPreventiva: p?.acaoPreventiva || null,
    impacto: p?.impacto || 'Alto',
    foto: p?.foto || null,
    paradaEditando: id,
    modo: 'encerrar'
  };
  navigate('registro');
}

export function abrirCorrigir(p){
  state.draft = {
    categoria: p.categoria, subcausa: p.subcausa,
    acaoComponente: p.acaoComponente, acaoPreventiva: p.acaoPreventiva,
    impacto: p.impacto, foto: p.foto,
    paradaEditando: p.id, modo: 'editar'
  };
  navigate('registro');
}

export function abrirAtender(){
  const abertas = state.db.paradas.filter(p => p.status === 'aguardando');
  if(abertas.length === 0){ toast('Nenhuma parada aguardando.', 'green'); return; }
  const html = abertas.map(p => {
    const m = getMaquina(p.maquinaId);
    return `
      <button class="card" style="text-align:left; cursor:pointer; border:none; width:100%; font-family:inherit; padding:14px; margin-bottom:10px; border-left:4px solid var(--red); background:var(--panel);" onclick="closeModal(); abrirAssumir('${p.id}');">
        <div class="top">
          <div>
            <div class="title">#${p.numero} · ${escapeHtml(m?.nome || '—')}</div>
            <div class="subtitle">${escapeHtml(p.setor)} · parada há ${fmtMin(Date.now() - p.horaInicio)}</div>
          </div>
        </div>
      </button>
    `;
  }).join('');
  openModal('amarelo', '🟡', 'Assumir parada', html);
}

export function abrirVoltou(){
  const emAtend = state.db.paradas.filter(p => p.status === 'atendendo' || p.status === 'aguardando');
  if(emAtend.length === 0){ toast('Nenhuma parada em andamento.', 'green'); return; }
  const html = emAtend.map(p => {
    const m = getMaquina(p.maquinaId);
    const cor = p.status === 'atendendo' ? 'var(--sun)' : 'var(--red)';
    const lbl = p.status === 'atendendo' ? '🟡 Em atendimento' : '🔴 Aguardando';
    return `
      <button class="card" style="text-align:left; cursor:pointer; border:none; width:100%; font-family:inherit; padding:14px; margin-bottom:10px; border-left:4px solid ${cor}; background:var(--panel);" onclick="closeModal(); irParaEncerramento('${p.id}');">
        <div class="top">
          <div>
            <div class="title">#${p.numero} · ${escapeHtml(m?.nome || '—')}</div>
            <div class="subtitle">${lbl} · ${fmtMin(Date.now() - p.horaInicio)}</div>
          </div>
        </div>
      </button>
    `;
  }).join('');
  openModal('verde', '🟢', 'Encerrar parada', html);
}