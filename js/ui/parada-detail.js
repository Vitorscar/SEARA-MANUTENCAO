import { getMaquina, getTecnico } from '../core/state.js';
import { openModal } from './modal.js';
import { fmtDuracaoMin, escapeHtml } from '../core/utils.js';
import { base64ParaUrl, formatarPeso } from '../services/anexos.service.js';

export function abrirDetalheParada(p){
  const m = getMaquina(p.maquinaId);
  const t = p.tecnicoId ? getTecnico(p.tecnicoId) : null;
  const dur = p.duracaoMin ?? Math.round((Date.now() - p.horaInicio) / 60000);
  const anexos = p.anexos || (p.foto ? [{ tipo:'foto', mime:'image/jpeg', data:p.foto.split(',')[1] || p.foto, ts:0 }] : []);

  openModal('', '📄', `Parada #${p.numero}`, `
    <!-- Cabeçalho -->
    <div class="pd-head">
      <div class="pd-head-row">
        <b>${escapeHtml(m?.nome || '—')}</b>
        <span class="pd-status pd-${p.status}">${labelStatus(p.status)}</span>
      </div>
      <div class="pd-head-sub">
        ${escapeHtml(p.setor)} · ${escapeHtml(p.turno)}
      </div>
    </div>

    <!-- Timeline -->
    <div class="pd-timeline">
      <div class="pd-time-item">
        <span class="pd-dot red"></span>
        <div>
          <div class="pd-time-lbl">Registrada</div>
          <div class="pd-time-val">${fmtHora(p.horaInicio)}</div>
        </div>
      </div>
      ${p.horaAssumida ? `
        <div class="pd-time-item">
          <span class="pd-dot sun"></span>
          <div>
            <div class="pd-time-lbl">Assumida por ${escapeHtml(t?.nome || '—')}</div>
            <div class="pd-time-val">${fmtHora(p.horaAssumida)}</div>
          </div>
        </div>
      ` : ''}
      ${p.horaFim ? `
        <div class="pd-time-item">
          <span class="pd-dot green"></span>
          <div>
            <div class="pd-time-lbl">Encerrada</div>
            <div class="pd-time-val">${fmtHora(p.horaFim)} · duração <b>${fmtDuracaoMin(dur)}</b></div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Formulário preenchido -->
    <div class="pd-section">
      <div class="pd-title">Dados do registro</div>
      <div class="pd-grid">
        <div class="pd-field"><span>Impacto</span><b>${escapeHtml(p.impacto || '—')}</b></div>
        <div class="pd-field"><span>Duração</span><b>${fmtDuracaoMin(dur)}</b></div>
        <div class="pd-field"><span>Tipo de falha</span><b>${escapeHtml(p.categoria || '—')}</b></div>
        <div class="pd-field"><span>Subcausa</span><b>${escapeHtml(p.subcausa || '—')}</b></div>
        <div class="pd-field full"><span>Componente</span><b>${escapeHtml(p.componente || '—')}</b></div>
        <div class="pd-field full"><span>Causa raiz</span><b>${escapeHtml(p.causaRaiz || '—')}</b></div>
        <div class="pd-field"><span>Ação no componente</span><b>${escapeHtml(p.acaoComponente || '—')}</b></div>
        <div class="pd-field"><span>Ação preventiva</span><b>${escapeHtml(p.acaoPreventiva || '—')}</b></div>
        <div class="pd-field full"><span>Responsável</span><b>${escapeHtml(p.responsavel || t?.nome || '—')}</b></div>
        ${p.observacao ? `<div class="pd-field full"><span>Observação</span><b>${escapeHtml(p.observacao)}</b></div>` : ''}
      </div>
    </div>

    <!-- Anexos -->
    ${anexos.length > 0 ? `
      <div class="pd-section">
        <div class="pd-title">Anexos (${anexos.length})</div>
        <div class="pd-anexos">
          ${anexos.map(a => renderAnexo(a)).join('')}
        </div>
      </div>
    ` : ''}

    <div style="display:flex; gap:10px; margin-top:16px;">
      <button class="btn block ghost" onclick="closeModal()">Fechar</button>
      <button class="btn block primary" onclick="exportarParada('${p.id}')">⬇️ Exportar</button>
    </div>
  `);
}

function renderAnexo(a){
  if(a.tipo === 'foto'){
    return `
      <figure class="pd-anexo">
        <img src="${base64ParaUrl(a.data, a.mime)}" onclick="abrirZoom(this.src)" alt="">
        <figcaption>📷 Foto</figcaption>
      </figure>
    `;
  }
  if(a.tipo === 'video'){
    return `
      <figure class="pd-anexo">
        <video src="${base64ParaUrl(a.data, a.mime)}" controls preload="metadata"></video>
        <figcaption>🎥 Vídeo · ${formatarPeso(a.tamanho)}</figcaption>
      </figure>
    `;
  }
  if(a.tipo === 'audio'){
    return `
      <figure class="pd-anexo pd-anexo-audio">
        <div style="font-size:28px; text-align:center; padding:10px 0;">🎤</div>
        <audio controls src="${base64ParaUrl(a.data, a.mime)}"></audio>
        <figcaption>Áudio · ${a.duracao || 0}s</figcaption>
      </figure>
    `;
  }
  return '';
}

function labelStatus(s){
  return { aguardando:'🔴 Aguardando', atendendo:'🟡 Atendendo', encerrada:'🟢 Encerrada', cancelada:'⚫ Cancelada' }[s] || s;
}
function fmtHora(iso){
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

/* Abre imagem em overlay fullscreen */
export function abrirZoom(src){
  const el = document.createElement('div');
  el.className = 'zoom-overlay';
  el.onclick = () => el.remove();
  el.innerHTML = `<img src="${src}" alt="">`;
  document.body.appendChild(el);
}

/* Exportação rápida de uma parada em JSON */
export function exportarParada(id){
  const p = window.state?.db?.paradas?.find(x => x.id === id);
  if(!p) return;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `parada_${p.numero}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
/* Wrapper que recebe só o ID — evita expor state no HTML */
export function abrirDetalheParadaPorId(id){
  const p = window.__state?.db?.paradas?.find(x => x.id === id);
  if(!p){
    console.warn('Parada não encontrada:', id);
    return;
  }
  abrirDetalheParada(p);
}