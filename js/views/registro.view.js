/* =========================================================
   registro.view.js — formulário completo
   Seções: Identificação · Tipo de Falha · Componente · Ação · Anexos · Fechamento
   ========================================================= */

import { state, salvarDB, novoDraft, getMaquina } from '../core/state.js';
import { navigate }                    from '../core/router.js';
import { toast }                       from '../ui/toast.js';
import { escapeHtml, turnoAtual }      from '../core/utils.js';
import { toggleDitado }                from '../services/voz.service.js';

import {
  TURNOS, IMPACTOS, TIPOS_FALHA, CAUSAS_RAIZ,
  ACOES_COMPONENTE, ACOES_PREVENTIVAS, COMPONENTES_SUG
} from '../data/constants.js';

import { criarParada, atualizarParada } from '../services/paradas.service.js';

import {
  processarFoto,
  processarVideo,
  iniciarGravacao,
  pararGravacao,
  estaGravando,
  removerAnexo,
  pesoAnexos,
  formatarPeso,
  base64ParaUrl
} from '../services/anexos.service.js';

/* =========================================================
   RENDER
   ========================================================= */
export function renderRegistro(){
  const user = state.db?.currentUser;
  const modo = state.draft?.modo || 'novo';
  const paradaEditando = modo === 'encerrar' && state.draft?.paradaEditando
    ? (state.db.paradas || []).find(p => p.id === state.draft.paradaEditando)
    : null;

  /* Garante draft de anexos */
  state.draft = state.draft || novoDraft();
  state.draft.anexos = state.draft.anexos || [];

  /* Máquinas agrupadas por setor */
  const porSetor = {};
  (state.db.maquinas || []).forEach(m => {
    const s = m.setor || 'Sem setor';
    (porSetor[s] = porSetor[s] || []).push(m);
  });
  const maquinasOptions = Object.keys(porSetor).sort().map(setor => {
    const opts = porSetor[setor]
      .sort((a,b) => (a.nome || '').localeCompare(b.nome || ''))
      .map(m => `<option value="${m.id}" ${paradaEditando?.maquinaId === m.id ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`)
      .join('');
    return `<optgroup label="${escapeHtml(setor)}">${opts}</optgroup>`;
  }).join('');

  /* Valores iniciais */
  const dataHoje      = new Date().toISOString().slice(0, 10);
  const chapaIni      = paradaEditando?.chapaTecnico || user?.chapa || '';
  const turnoIni      = paradaEditando?.turno || user?.turno || turnoAtual();
  const impactoIni    = paradaEditando?.impacto || 'Alto';
  const categoriaIni  = paradaEditando?.categoria || '';
  const causaIni      = paradaEditando?.causaRaizCategoria || '';
  const componenteIni = paradaEditando?.componente || '';
  const acaoIni       = paradaEditando?.acaoComponente || '';
  const preventivaIni = paradaEditando?.acaoPreventiva || '';
  const respIni       = paradaEditando?.responsavel || user?.nome || '';
  const obsIni        = paradaEditando?.observacao || '';

  document.getElementById('view').innerHTML = `
    <div class="registro-wrap">

      <div class="reg-header">
        <button type="button" class="reg-voltar" onclick="cancelarRegistro()">←</button>
        <h2>${modo === 'encerrar'
              ? 'Encerrar · ' + (paradaEditando?.numero ? '#' + paradaEditando.numero : 'Parada')
              : 'Registrar parada'}</h2>
        <div style="width:36px;"></div>
      </div>

      <form id="formRegistro" class="reg-form"
            onsubmit="event.preventDefault(); salvarRegistro();">

        <!-- ═══════════════ IDENTIFICAÇÃO ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head">
            <span class="form-card__dot"></span>
            <h3>Identificação</h3>
          </div>
          <div class="form-card__body">

            <div class="reg-row cols-3">
              <div class="reg-field">
                <label>Data <span class="req">*</span></label>
                <input type="date" id="regData" value="${dataHoje}" required>
              </div>
              <div class="reg-field">
                <label>Turno <span class="req">*</span></label>
                <select id="regTurno" required>
                  ${TURNOS.map(t => `<option ${t === turnoIni ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
                </select>
              </div>
              <div class="reg-field">
                <label>Impacto <span class="req">*</span></label>
                <select id="regImpacto" required>
                  ${IMPACTOS.map(i => `<option ${i === impactoIni ? 'selected' : ''}>${escapeHtml(i)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="reg-field">
              <label>Chapa do técnico <span class="req">*</span></label>
              <input type="text" id="regChapa" value="${escapeHtml(chapaIni)}"
                     inputmode="numeric" maxlength="9" placeholder="000000000" required>
            </div>

            <div class="reg-field">
              <label>Máquina / equipamento <span class="req">*</span></label>
              <select id="regMaquina" required>
                <option value="">Selecione…</option>
                ${maquinasOptions}
              </select>
            </div>

          </div>
        </div>

        <!-- ═══════════════ TIPO DE FALHA ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head form-card__head--sun">
            <span class="form-card__dot form-card__dot--sun"></span>
            <h3>Tipo de Falha</h3>
          </div>
          <div class="form-card__body">

            <div class="reg-field">
              <label>Tipo de Falha <span class="req">*</span></label>
              <select id="regTipoFalha" required>
                <option value="">Selecione…</option>
                ${TIPOS_FALHA.map(t =>
                  `<option ${t === categoriaIni ? 'selected' : ''}>${escapeHtml(t)}</option>`
                ).join('')}
              </select>
            </div>

            <div class="reg-field" style="margin-top:14px;">
              <label>Causa Raiz <span class="req">*</span></label>
              <select id="regCausaRaizCat" required>
                <option value="">Selecione…</option>
                ${CAUSAS_RAIZ.map(c =>
                  `<option ${c === causaIni ? 'selected' : ''}>${escapeHtml(c)}</option>`
                ).join('')}
              </select>
            </div>

          </div>
        </div>

        <!-- ═══════════════ COMPONENTE ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head">
            <span class="form-card__dot"></span>
            <h3>Componente</h3>
          </div>
          <div class="form-card__body">
            <div class="reg-field">
              <label>Nome do componente <span class="req">*</span></label>
              <input type="text" id="regComponente"
                     value="${escapeHtml(componenteIni)}"
                     list="listaComponentes"
                     placeholder="Ex: Rolamento 6205, Correia A-42…"
                     autocomplete="off" required>
              <datalist id="listaComponentes">
                ${COMPONENTES_SUG.map(c => `<option value="${escapeHtml(c)}">`).join('')}
              </datalist>
            </div>
          </div>
        </div>

        <!-- ═══════════════ AÇÃO ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head form-card__head--green">
            <span class="form-card__dot form-card__dot--green"></span>
            <h3>Ação</h3>
          </div>
          <div class="form-card__body">

            <div class="reg-field">
              <label>Ação no componente <span class="req">*</span></label>
              <div class="reg-chips reg-chips--sm" id="regAcaoCompGrid">
                ${ACOES_COMPONENTE.map(a => `
                  <button type="button"
                          class="reg-chip ${a === acaoIni ? 'active' : ''}"
                          data-val="${escapeHtml(a)}"
                          onclick="selecionarChipAcao(this)">
                    ${escapeHtml(a)}
                  </button>
                `).join('')}
              </div>
              <input type="hidden" id="regAcaoComp" value="${escapeHtml(acaoIni)}" required>
            </div>

            <div class="reg-field" style="margin-top:14px;">
              <label>Ação preventiva</label>
              <div class="reg-chips reg-chips--sm" id="regAcaoPrevGrid">
                ${ACOES_PREVENTIVAS.map(a => `
                  <button type="button"
                          class="reg-chip ${a === preventivaIni ? 'active' : ''}"
                          data-val="${escapeHtml(a)}"
                          onclick="selecionarChipPreventiva(this)">
                    ${escapeHtml(a)}
                  </button>
                `).join('')}
              </div>
              <input type="hidden" id="regAcaoPreventiva" value="${escapeHtml(preventivaIni)}">
            </div>

          </div>
        </div>

        <!-- ═══════════════ ANEXOS ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head">
            <span class="form-card__dot"></span>
            <h3>Anexos</h3>
          </div>
          <div class="form-card__body">

            <div class="anexos-botoes">
              <button type="button" class="anexo-btn"
                      onclick="document.getElementById('regFotoInput').click()">
                <span class="anexo-ic">📷</span>
                <span class="anexo-lbl">Foto</span>
              </button>

              <button type="button" class="anexo-btn" id="regBtnAudio"
                      onclick="toggleAudioRegistro()">
                <span class="anexo-ic" id="regAudioIc">🎤</span>
                <span class="anexo-lbl" id="regAudioLbl">Áudio</span>
              </button>

              <button type="button" class="anexo-btn"
                      onclick="document.getElementById('regVideoInput').click()">
                <span class="anexo-ic">🎥</span>
                <span class="anexo-lbl">Vídeo</span>
              </button>
            </div>

            <input type="file" id="regFotoInput" accept="image/*"
                   capture="environment" style="display:none"
                   onchange="onFotoRegistro(event)">
            <input type="file" id="regVideoInput" accept="video/*"
                   capture="environment" style="display:none"
                   onchange="onVideoRegistro(event)">

            <div id="regAudioStatus" class="audio-status hidden">
              <span class="audio-rec-dot"></span>
              <span>Gravando… <b id="regAudioTimer">0s</b> / 45s</span>
              <button type="button" class="audio-stop"
                      onclick="toggleAudioRegistro()">Parar</button>
            </div>

            <div id="regListaAnexos" class="anexos-lista"></div>
            <div id="regPesoAnexos" class="anexos-peso hidden"></div>

          </div>
        </div>

        <!-- ═══════════════ FECHAMENTO ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head">
            <span class="form-card__dot"></span>
            <h3>Fechamento</h3>
          </div>
          <div class="form-card__body">

            <div class="reg-field">
              <label>Responsável <span class="req">*</span></label>
              <input type="text" id="regResponsavel"
                     value="${escapeHtml(respIni)}"
                     placeholder="Nome do técnico" required>
            </div>

            <div class="reg-field" style="margin-top:14px;">
              <label>Observação (opcional)</label>
              <div class="reg-obs-wrap">
                <textarea id="regObs" rows="3"
                          placeholder="Detalhes do reparo…">${escapeHtml(obsIni)}</textarea>
                <button type="button" class="reg-mic"
                        onclick="toggleDitado('regObs')" title="Ditar">🎤</button>
              </div>
            </div>

          </div>
        </div>

        <p id="regErro" class="field-error hidden"></p>

        <div class="reg-actions">
          <button type="submit" class="reg-btn-primary" id="btnSalvar">
            ${modo === 'encerrar' ? '✅ ENCERRAR PARADA' : '🚨 REGISTRAR PARADA'}
          </button>
        </div>

      </form>
    </div>
  `;

  /* Renderiza anexos já gravados (se houver) */
  renderAnexosLista();
}

/* =========================================================
   CHIPS — AÇÃO
   ========================================================= */
export function selecionarChipAcao(btn){
  document.querySelectorAll('#regAcaoCompGrid .reg-chip')
    .forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('regAcaoComp').value = btn.dataset.val;
}

export function selecionarChipPreventiva(btn){
  document.querySelectorAll('#regAcaoPrevGrid .reg-chip')
    .forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('regAcaoPreventiva').value = btn.dataset.val;
}

/* =========================================================
   CANCELAR
   ========================================================= */
export function cancelarRegistro(){
  state.draft = novoDraft();
  navigate('radar');
}

/* =========================================================
   ANEXOS — FOTO
   ========================================================= */
export async function onFotoRegistro(event){
  const file = event.target.files?.[0];
  if(!file) return;

  try {
    const anexo = await processarFoto(file);
    state.draft.anexos = [...(state.draft.anexos || []), anexo];
    event.target.value = '';
    renderAnexosLista();
    toast('Foto anexada', 'success');
  } catch(err){
    console.error('[registro] erro foto:', err);
    toast('Erro ao processar foto', 'error');
  }
}

/* =========================================================
   ANEXOS — VÍDEO
   ========================================================= */
export async function onVideoRegistro(event){
  const file = event.target.files?.[0];
  if(!file) return;

  try {
    const anexo = await processarVideo(file);
    state.draft.anexos = [...(state.draft.anexos || []), anexo];
    event.target.value = '';
    renderAnexosLista();
    toast('Vídeo anexado', 'success');
  } catch(err){
    console.error('[registro] erro vídeo:', err);
    toast(err.message || 'Erro no vídeo', 'error');
  }
}

/* =========================================================
   ANEXOS — ÁUDIO
   ========================================================= */
export async function toggleAudioRegistro(){
  if(estaGravando()){ pararGravacao(); return; }

  const status = document.getElementById('regAudioStatus');
  const ic     = document.getElementById('regAudioIc');
  const lbl    = document.getElementById('regAudioLbl');

  try {
    status.classList.remove('hidden');
    ic.textContent  = '⏹';
    lbl.textContent = 'Parar';

    await iniciarGravacao({
      onTick: (s) => {
        const el = document.getElementById('regAudioTimer');
        if(el) el.textContent = s + 's';
      },
      onEnd: (anexo, dur) => {
        status.classList.add('hidden');
        ic.textContent  = '🎤';
        lbl.textContent = 'Áudio';

        if(anexo){
          state.draft.anexos = [...(state.draft.anexos || []), anexo];
          renderAnexosLista();
          toast(`Áudio gravado (${dur}s)`, 'success');
        }
      }
    });
  } catch(err){
    status.classList.add('hidden');
    ic.textContent  = '🎤';
    lbl.textContent = 'Áudio';
    toast(err.message || 'Não foi possível gravar', 'error');
  }
}

/* =========================================================
   ANEXOS — LISTA
   ========================================================= */
export function removerAnexoRegistro(ts){
  state.draft.anexos = removerAnexo(state.draft.anexos, ts);
  renderAnexosLista();
}

function renderAnexosLista(){
  const cont = document.getElementById('regListaAnexos');
  const peso = document.getElementById('regPesoAnexos');
  if(!cont) return;

  const anexos = state.draft.anexos || [];

  if(anexos.length === 0){
    cont.innerHTML = '';
    peso?.classList.add('hidden');
    return;
  }

  cont.innerHTML = anexos.map(a => {
    if(a.tipo === 'foto'){
      return `
        <div class="anexo-item">
          <img src="${base64ParaUrl(a.data, a.mime)}" alt="" class="anexo-thumb">
          <div class="anexo-info">
            <span class="anexo-tag">📷 Foto</span>
            <span class="anexo-size">${formatarPeso(a.tamanho)}</span>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${a.ts})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'video'){
      return `
        <div class="anexo-item">
          <video src="${base64ParaUrl(a.data, a.mime)}"
                 class="anexo-thumb" muted></video>
          <div class="anexo-info">
            <span class="anexo-tag">🎥 Vídeo</span>
            <span class="anexo-size">${formatarPeso(a.tamanho)}</span>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${a.ts})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'audio'){
      return `
        <div class="anexo-item anexo-audio">
          <div class="anexo-audio-ic">🎤</div>
          <div class="anexo-info">
            <span class="anexo-tag">Áudio · ${a.duracao || 0}s</span>
            <audio controls src="${base64ParaUrl(a.data, a.mime)}"
                   style="height:28px;margin-top:3px;width:100%;"></audio>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${a.ts})">✕</button>
        </div>
      `;
    }
    return '';
  }).join('');

  if(peso){
    const total = pesoAnexos(anexos);
    peso.textContent = `Total: ${formatarPeso(total)} em ${anexos.length} anexo(s)`;
    peso.classList.remove('hidden');
  }
}

/* =========================================================
   SALVAR
   ========================================================= */
export async function salvarRegistro(){
  const btn  = document.getElementById('btnSalvar');
  const modo = state.draft?.modo || 'novo';
  const erro = document.getElementById('regErro');
  erro.classList.add('hidden');

  /* Coleta */
  const data        = document.getElementById('regData').value;
  const chapa       = document.getElementById('regChapa').value.replace(/\D/g, '');
  const maquinaId   = document.getElementById('regMaquina').value;
  const turno       = document.getElementById('regTurno').value;
  const impacto     = document.getElementById('regImpacto').value;
  const categoria   = document.getElementById('regTipoFalha').value;
  const causaRaiz   = document.getElementById('regCausaRaizCat').value;
  const componente  = document.getElementById('regComponente').value.trim();
  const acaoComp    = document.getElementById('regAcaoComp').value;
  const acaoPrev    = document.getElementById('regAcaoPreventiva').value;
  const responsavel = document.getElementById('regResponsavel').value.trim();
  const obs         = document.getElementById('regObs').value.trim();
  const anexos      = state.draft.anexos || [];

  /* Validações */
  if(chapa.length !== 9)   return mostrarErro(erro, 'Chapa deve ter 9 dígitos.');
  if(!maquinaId)           return mostrarErro(erro, 'Selecione a máquina.');
  if(!categoria)           return mostrarErro(erro, 'Escolha o Tipo de Falha.');
  if(!causaRaiz)           return mostrarErro(erro, 'Escolha a Causa Raiz.');
  if(!componente)          return mostrarErro(erro, 'Informe o componente.');
  if(!acaoComp)            return mostrarErro(erro, 'Escolha a ação no componente.');
  if(!responsavel)         return mostrarErro(erro, 'Informe o responsável.');

  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    if(modo === 'encerrar' && state.draft.paradaEditando){
      await atualizarParada(state.draft.paradaEditando, {
        data, chapa, turno, impacto, categoria,
        causaRaiz, componente,
        acaoComponente: acaoComp, acaoPreventiva: acaoPrev,
        responsavel, observacao: obs,
        anexos
      }, { encerrar: true });

      toast('Parada encerrada', 'success');
    } else {
      const parada = await criarParada({
        data, chapa, maquinaId, turno, impacto,
        categoria, causaRaiz, componente,
        acaoComponente: acaoComp, acaoPreventiva: acaoPrev,
        responsavel, observacao: obs,
        anexos
      });

      toast(`Parada #${parada.numero} registrada`, 'success');
    }

    state.draft = novoDraft();
    navigate('radar');

  } catch(err){
    mostrarErro(erro, err.message || 'Erro ao salvar.');
    btn.disabled = false;
    btn.textContent = modo === 'encerrar'
      ? '✅ ENCERRAR PARADA'
      : '🚨 REGISTRAR PARADA';
  }
}

function mostrarErro(el, msg){
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* =========================================================
   EXPOSIÇÃO GLOBAL — para os onclick/onchange inline do HTML
   ⚡ ESSENCIAL: sem isto, os handlers inline não funcionam
   ========================================================= */
Object.assign(window, {
  renderRegistro,
  salvarRegistro,
  cancelarRegistro,
  selecionarChipAcao,
  selecionarChipPreventiva,
  onFotoRegistro,
  onVideoRegistro,
  toggleAudioRegistro,
  removerAnexoRegistro,
  toggleDitado
});