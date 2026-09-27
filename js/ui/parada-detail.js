/* =========================================================
   parada-detail.js — modal de detalhe da parada
   🆕 Sem hora_assumida, sem hora_fim. Só hora_inicio +
      duracao_min.
   ========================================================= */

import { state, getMaquina, getTecnico } from '../core/state.js';
import { openModal }                       from './modal.js';
import { listarAnexos, urlAnexo }          from '../services/anexos.service.js';
import { fmtDuracaoMin, escapeHtml }       from '../core/utils.js';

export async function abrirDetalheParada(parada){
  if(!parada) return;

  const maq = getMaquina(parada.maquinaId);
  const tec = parada.tecnicoId ? getTecnico(parada.tecnicoId) : null;

  openModal('', '📄', `Parada #${parada.numero}`, `
    <div class="pd-loading">Carregando anexos…</div>
  `);

  let anexos = [];
  try {
    anexos = await listarAnexos(parada.id);
  } catch(err){
    console.warn('[parada-detail] erro ao listar anexos:', err.message);
  }

  const anexosComUrl = await Promise.all(anexos.map(async a => {
    try {
      const url = await urlAnexo(a.storage_path);
      return { ...a, url };
    } catch(_) {
      return { ...a, url: null };
    }
  }));

  const modalContent = document.querySelector('#modalRoot .modal-content');
  if(!modalContent) return;

  const header = modalContent.querySelector('.modal-header');

  modalContent.innerHTML = `
    ${header?.outerHTML || ''}
    ${htmlConteudo(parada, maq, tec, anexosComUrl)}
  `;

  modalContent.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('modalRoot').innerHTML = '';
  });
}

export function abrirDetalheParadaPorId(id){
  const parada = (state.db?.paradas || []).find(x => x.id === id);
  if(!parada) return;
  return abrirDetalheParada(parada);
}

export function abrirZoom(src){
  if(!src) return;
  const el = document.createElement('div');
  el.className = 'zoom-overlay';
  el.onclick = () => el.remove();
  el.innerHTML = `<img src="${src}" alt="">`;
  document.body.appendChild(el);
}

export function exportarParada(id){
  const parada = (state.db?.paradas || []).find(x => x.id === id);
  if(!parada) return;
  const blob = new Blob(
    [JSON.stringify(parada, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = `parada_${parada.numero || id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================================================
   HTML
   ========================================================= */
function htmlConteudo(p, maq, tec, anexos){
  const dur = p.duracaoMin || 0;

  return `
    <div class="pd-head">
      <div class="pd-head__row">
        <b>${escapeHtml(maq?.nome || p.maquinaNome || '—')}</b>
        <span class="pd-status pd-status--${p.status}">${labelStatus(p.status)}</span>
      </div>
      <div class="pd-head__sub">
        ${escapeHtml(p.setor || '')}
        ${p.turno ? ' · ' + escapeHtml(p.turno) : ''}
      </div>
    </div>

    <!-- Timeline simplificada -->
    <div class="pd-timeline">
      <div class="pd-timeline__item">
        <span class="pd-timeline__dot pd-timeline__dot--red"></span>
        <div>
          <div class="pd-timeline__lbl">Registrada em</div>
          <div class="pd-timeline__val">${fmtHora(p.horaInicio)}</div>
        </div>
      </div>
      <div class="pd-timeline__item">
        <span class="pd-timeline__dot pd-timeline__dot--green"></span>
        <div>
          <div class="pd-timeline__lbl">Tempo total</div>
          <div class="pd-timeline__val"><b>${fmtDuracaoMin(dur)}</b></div>
        </div>
      </div>
    </div>

    <!-- Ficha -->
    <div class="pd-section">
      <div class="pd-section__title">Ficha de registro</div>
      <div class="pd-grid">
        <div class="pd-field">
          <span>Impacto</span>
          <b>${escapeHtml(p.impacto || '—')}</b>
        </div>
        <div class="pd-field">
          <span>Duração</span>
          <b>${fmtDuracaoMin(dur)}</b>
        </div>
        <div class="pd-field">
          <span>Tipo de falha</span>
          <b>${escapeHtml(p.categoria || '—')}</b>
        </div>
        <div class="pd-field">
          <span>Causa raiz</span>
          <b>${escapeHtml(p.causaRaizCategoria || '—')}</b>
        </div>
        <div class="pd-field pd-field--full">
          <span>Componente</span>
          <b>${escapeHtml(p.componente || '—')}</b>
        </div>
        <div class="pd-field">
          <span>Ação no componente</span>
          <b>${escapeHtml(p.acaoComponente || '—')}</b>
        </div>
        <div class="pd-field">
          <span>Ação preventiva</span>
          <b>${escapeHtml(p.acaoPreventiva || '—')}</b>
        </div>
        <div class="pd-field pd-field--full">
          <span>Responsável</span>
          <b>${escapeHtml(p.responsavel || tec?.nome || '—')}</b>
        </div>
        ${p.observacao ? `
          <div class="pd-field pd-field--full">
            <span>Observação</span>
            <b>${escapeHtml(p.observacao)}</b>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Anexos -->
    <div class="pd-section">
      <div class="pd-section__title">
        Anexos ${anexos.length ? `(${anexos.length})` : ''}
      </div>
      ${anexos.length === 0
        ? '<div class="pd-empty">Nenhum anexo registrado.</div>'
        : `<div class="pd-anexos">
             ${anexos.map(renderAnexo).join('')}
           </div>`
      }
    </div>

    <div class="pd-actions">
      <button type="button" class="btn btn--secondary"
              onclick="document.getElementById('modalRoot').innerHTML=''">
        Fechar
      </button>
      <button type="button" class="btn btn--primary"
              onclick="exportarParada('${p.id}')">
        ⬇️ Exportar JSON
      </button>
    </div>
  `;
}

function renderAnexo(a){
  if(!a.url){
    return `
      <div class="pd-anexo pd-anexo--erro">
        <span>⚠️</span>
        <small>Erro ao carregar ${escapeHtml(a.tipo)}</small>
      </div>
    `;
  }
  if(a.tipo === 'foto'){
    return `
      <figure class="pd-anexo">
        <img src="${a.url}" alt="Foto" loading="lazy"
             onclick="abrirZoom('${a.url}')">
        <figcaption>📷 Foto</figcaption>
      </figure>
    `;
  }
  if(a.tipo === 'video'){
    return `
      <figure class="pd-anexo pd-anexo--video">
        <video src="${a.url}" controls preload="metadata"></video>
        <figcaption>🎥 Vídeo</figcaption>
      </figure>
    `;
  }
  if(a.tipo === 'audio'){
    return `
      <figure class="pd-anexo pd-anexo--audio">
        <div class="pd-anexo__icon">🎤</div>
        <audio src="${a.url}" controls preload="metadata"></audio>
        <figcaption>Áudio · ${a.duracao || 0}s</figcaption>
      </figure>
    `;
  }
  return '';
}

function labelStatus(s){
  return {
    aguardando: '🔴 Aguardando',
    atendendo:  '🟡 Em andamento',
    encerrada:  '🟢 Encerrada',
    cancelada:  '⚫ Cancelada'
  }[s] || s;
}

function fmtHora(ts){
  if(!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}
