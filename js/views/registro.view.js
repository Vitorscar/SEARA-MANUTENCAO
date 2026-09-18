/* =========================================================
   registro.view.js — formulário completo de parada
   • Identificação: Chapa → Nome + Gestor automáticos
   • Cascata: Setor → Máquina (filtrada)
   • Anexos via Supabase Storage
   ========================================================= */

import { state, novoDraft, getMaquina } from '../core/state.js';
import { navigate }                    from '../core/router.js';
import { toast }                       from '../ui/toast.js';
import { escapeHtml, turnoAtual }      from '../core/utils.js';
import { toggleDitado }                from '../services/voz.service.js';
import { api }                         from '../data/api.js';

import {
  TURNOS, IMPACTOS, TIPOS_FALHA, CAUSAS_RAIZ,
  ACOES_COMPONENTE, ACOES_PREVENTIVAS, COMPONENTES_SUG
} from '../data/constants.js';

import { criarParada, atualizarParada } from '../services/paradas.service.js';

import {
  iniciarGravacao, pararGravacao, estaGravando,
  uploadFoto, uploadVideo, uploadAudio, formatarPeso
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

  /* Garante draft limpo */
  state.draft = state.draft || novoDraft();
  state.draft.anexosPendentes = state.draft.anexosPendentes || [];

  /* Setores únicos (ordem crescente) */
  const setores = [...new Set((state.db.maquinas || [])
    .map(m => m.setor)
    .filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, 'pt-BR'));

  /* Setor inicial (edição ou vazio) */
  const setorIni = paradaEditando?.setor || '';

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

            <!-- Chapa -->
            <div class="reg-field">
              <label>Chapa do funcionário <span class="req">*</span></label>
              <input type="text" id="regChapa" value="${escapeHtml(chapaIni)}"
                     inputmode="numeric" maxlength="10"
                     placeholder="0000000000" required>
              <small class="reg-hint">10 dígitos numéricos</small>
            </div>

            <!-- Painel do funcionário (nome + cargo + gestor) -->
            <div id="regFuncionarioInfo" class="reg-func-info hidden"></div>

          </div>
        </div>

        <!-- ═══════════════ LOCALIZAÇÃO ═══════════════ -->
        <div class="form-card">
          <div class="form-card__head form-card__head--sun">
            <span class="form-card__dot form-card__dot--sun"></span>
            <h3>Localização da parada</h3>
          </div>
          <div class="form-card__body">

            <div class="reg-row cols-2">
              <div class="reg-field">
                <label>Setor <span class="req">*</span></label>
                <select id="regSetor" required>
                  <option value="">Selecione o setor…</option>
                  ${setores.map(s =>
                    `<option ${s === setorIni ? 'selected' : ''}>${escapeHtml(s)}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="reg-field">
                <label>Máquina <span class="req">*</span></label>
                <select id="regMaquina" required disabled>
                  <option value="">Selecione o setor primeiro…</option>
                </select>
              </div>
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
              <span>Gravando… <b id="regAudioTimer">0s</b> / 60s</span>
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

  /* ---------- Wiring ---------- */
  wireChapa();
  wireSetor();
  wireChips();
  wireAnexos();

  /* Se editando, pré-popula */
  if(paradaEditando){
    // Preenche setor + máquina
    const setorEl = document.getElementById('regSetor');
    if(paradaEditando.setor){
      setorEl.value = paradaEditando.setor;
      onSetorChange();
      const maqEl = document.getElementById('regMaquina');
      if(maqEl && paradaEditando.maquinaId){
        maqEl.value = paradaEditando.maquinaId;
      }
    }
    // Pré-preenche os chips de ação
    if(acaoIni){
      document.querySelectorAll('#regAcaoCompGrid .reg-chip').forEach(c => {
        if(c.dataset.val === acaoIni) c.classList.add('active');
      });
    }
    if(preventivaIni){
      document.querySelectorAll('#regAcaoPrevGrid .reg-chip').forEach(c => {
        if(c.dataset.val === preventivaIni) c.classList.add('active');
      });
    }
  }

  /* Auto-preenche gestor pra chapa inicial */
  atualizarInfoFuncionario();

  renderAnexosLista();
}

/* =========================================================
   CHAPA → NOME + CARGO + GESTOR
   ========================================================= */
function wireChapa(){
  const inp = document.getElementById('regChapa');
  if(!inp) return;

  /* Só números + atualiza info */
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(0, 10);
    atualizarInfoFuncionario();
  });

  inp.addEventListener('blur', atualizarInfoFuncionario);
}

function atualizarInfoFuncionario(){
  const inp    = document.getElementById('regChapa');
  const infoEl = document.getElementById('regFuncionarioInfo');
  const respEl = document.getElementById('regResponsavel');
  if(!inp || !infoEl) return;

  const chapa = inp.value.replace(/\D/g, '');
  const user  = state.db?.currentUser;

  /* Só preenche quando tiver 10 dígitos */
  if(chapa.length !== 10){
    infoEl.classList.add('hidden');
    infoEl.innerHTML = '';
    return;
  }

  /* Busca técnico no cache */
  let tec = (state.db?.tecnicos || []).find(t => t.chapa === chapa);

  /* Fallback: se for a chapa do usuário logado */
  if(!tec && chapa === user?.chapa){
    tec = {
      nome:          user.nome,
      especialidade: user.especialidade,
      gestor:        user.gestor || '',
      chapa:         chapa
    };
  }

  if(!tec){
    infoEl.classList.remove('hidden');
    infoEl.innerHTML = `<div class="reg-func-info__err">⚠️ Chapa não encontrada no cadastro.</div>`;
    return;
  }

  /* Preenche o responsável automaticamente */
  if(respEl && !respEl.value.trim()){
    respEl.value = tec.nome;
  } else if(respEl){
    respEl.value = tec.nome;   // sobrescreve sempre que a chapa mudar
  }

  /* Renderiza o painel */
  infoEl.classList.remove('hidden');
  infoEl.innerHTML = `
    <div class="reg-func-info__row">
      <span class="lbl">Nome:</span>
      <b>${escapeHtml(tec.nome)}</b>
    </div>
    <div class="reg-func-info__row">
      <span class="lbl">Cargo:</span>
      <b>${escapeHtml(tec.especialidade || '—')}</b>
    </div>
    <div class="reg-func-info__row">
      <span class="lbl">Gestor:</span>
      <b>${escapeHtml(tec.gestor || '— não informado')}</b>
    </div>
  `;
}

/* =========================================================
   CASCATA — SETOR → MÁQUINA
   ========================================================= */
function wireSetor(){
  const selSetor = document.getElementById('regSetor');
  if(!selSetor) return;

  selSetor.addEventListener('change', onSetorChange);

  /* Se já tem setor selecionado, popula na hora */
  if(selSetor.value) onSetorChange();
}

function onSetorChange(){
  const setor = document.getElementById('regSetor').value;
  const sel   = document.getElementById('regMaquina');

  if(!sel) return;

  /* Sem setor → trava máquina */
  if(!setor){
    sel.disabled = true;
    sel.innerHTML = '<option value="">Selecione o setor primeiro…</option>';
    return;
  }

  /* Filtra máquinas do setor, ordena por nome */
  const maqs = (state.db?.maquinas || [])
    .filter(m => m.setor === setor)
    .sort((a,b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

  sel.disabled = false;
  sel.innerHTML = '<option value="">Selecione a máquina…</option>' +
    maqs.map(m => `
      <option value="${m.id}">${escapeHtml(m.nome)}</option>
    `).join('');
}

/* =========================================================
   CHIPS DE AÇÃO
   ========================================================= */
function wireChips(){
  /* Chips já têm onclick inline — nada a fazer */
}

/* =========================================================
   ANEXOS
   ========================================================= */
function wireAnexos(){
  /* Handlers já têm onclick inline — nada a fazer */
}

/* =========================================================
   EXPORTS
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

export function cancelarRegistro(){
  (state.draft.anexosPendentes || []).forEach(a => {
    if(a.preview) try { URL.revokeObjectURL(a.preview); } catch(_){}
  });
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
    const preview = URL.createObjectURL(file);

    state.draft.anexosPendentes = state.draft.anexosPendentes || [];
    state.draft.anexosPendentes.push({
      tipo:     'foto',
      blob:     file,
      preview,
      nome:     file.name,
      tamanho:  file.size
    });

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

  if(file.size > 20 * 1024 * 1024){
    toast('Vídeo muito grande (máx 20 MB)', 'error');
    event.target.value = '';
    return;
  }

  try {
    const preview = URL.createObjectURL(file);

    state.draft.anexosPendentes = state.draft.anexosPendentes || [];
    state.draft.anexosPendentes.push({
      tipo:    'video',
      blob:    file,
      preview,
      nome:    file.name,
      tamanho: file.size
    });

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
      onEnd: (blob, dur) => {
        status.classList.add('hidden');
        ic.textContent  = '🎤';
        lbl.textContent = 'Áudio';

        if(blob && blob.size > 0){
          const preview = URL.createObjectURL(blob);

          state.draft.anexosPendentes = state.draft.anexosPendentes || [];
          state.draft.anexosPendentes.push({
            tipo:     'audio',
            blob,
            preview,
            duracao:  dur,
            tamanho:  blob.size
          });

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
   ANEXOS — LISTA / PREVIEW
   ========================================================= */
export function removerAnexoRegistro(idx){
  const lista = state.draft.anexosPendentes || [];
  const item = lista[idx];
  if(item?.preview) try { URL.revokeObjectURL(item.preview); } catch(_){}

  lista.splice(idx, 1);
  renderAnexosLista();
}

function renderAnexosLista(){
  const cont = document.getElementById('regListaAnexos');
  const peso = document.getElementById('regPesoAnexos');
  if(!cont) return;

  const anexos = state.draft.anexosPendentes || [];

  if(anexos.length === 0){
    cont.innerHTML = '';
    peso?.classList.add('hidden');
    return;
  }

  cont.innerHTML = anexos.map((a, idx) => {
    if(a.tipo === 'foto'){
      return `
        <div class="anexo-item">
          <img src="${a.preview}" alt="" class="anexo-thumb">
          <div class="anexo-info">
            <span class="anexo-tag">📷 Foto</span>
            <span class="anexo-size">${formatarPeso(a.tamanho)}</span>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${idx})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'video'){
      return `
        <div class="anexo-item">
          <video src="${a.preview}" class="anexo-thumb" muted></video>
          <div class="anexo-info">
            <span class="anexo-tag">🎥 Vídeo</span>
            <span class="anexo-size">${formatarPeso(a.tamanho)}</span>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${idx})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'audio'){
      return `
        <div class="anexo-item anexo-audio">
          <div class="anexo-audio-ic">🎤</div>
          <div class="anexo-info">
            <span class="anexo-tag">Áudio · ${a.duracao || 0}s</span>
            <audio controls src="${a.preview}"
                   style="height:28px;margin-top:3px;width:100%;"></audio>
          </div>
          <button type="button" class="anexo-x"
                  onclick="removerAnexoRegistro(${idx})">✕</button>
        </div>
      `;
    }
    return '';
  }).join('');

  if(peso){
    const total = anexos.reduce((s,a) => s + (a.tamanho || 0), 0);
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
  const setor       = document.getElementById('regSetor').value;
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
  const anexos      = state.draft.anexosPendentes || [];

  /* Validações */
  if(chapa.length !== 10) return mostrarErro(erro, 'Chapa deve ter 10 dígitos.');
  if(!setor)              return mostrarErro(erro, 'Selecione o setor.');
  if(!maquinaId)          return mostrarErro(erro, 'Selecione a máquina.');
  if(!categoria)          return mostrarErro(erro, 'Escolha o Tipo de Falha.');
  if(!causaRaiz)          return mostrarErro(erro, 'Escolha a Causa Raiz.');
  if(!componente)         return mostrarErro(erro, 'Informe o componente.');
  if(!acaoComp)           return mostrarErro(erro, 'Escolha a ação no componente.');
  if(!responsavel)        return mostrarErro(erro, 'Informe o responsável.');

  /* Busca a máquina do cache (pro service confirmar) */
  const maq = (state.db.maquinas || []).find(m => m.id === maquinaId);

  /* 🆕 Valida que a máquina pertence ao setor selecionado */
  if(maq && maq.setor && maq.setor !== setor){
    return mostrarErro(erro, `A máquina "${maq.nome}" não pertence ao setor "${setor}".`);
  }

  btn.disabled = true;
  btn.textContent = 'Salvando parada…';

  try {
    let parada;

    if(modo === 'encerrar' && state.draft.paradaEditando){
      parada = await atualizarParada(state.draft.paradaEditando, {
        data, chapa, turno, impacto, categoria,
        causaRaiz, componente,
        acaoComponente: acaoComp,
        acaoPreventiva: acaoPrev,
        responsavel, observacao: obs,
        setor,
        area: maq?.area || ''
      }, { encerrar: true });
    } else {
      parada = await criarParada({
        data, chapa, maquinaId, turno, impacto,
        categoria, causaRaiz, componente,
        acaoComponente: acaoComp,
        acaoPreventiva: acaoPrev,
        responsavel, observacao: obs,
        setor,
        area: maq?.area || ''
      });
    }

    /* Upload dos anexos */
    if(anexos.length > 0 && parada?.id){
      let enviados = 0;
      btn.textContent = `Enviando anexos (0/${anexos.length})…`;

      for(const a of anexos){
        try {
          if(a.tipo === 'foto')  await uploadFoto(parada.id, a.blob);
          if(a.tipo === 'video') await uploadVideo(parada.id, a.blob);
          if(a.tipo === 'audio') await uploadAudio(parada.id, a.blob, a.duracao);
          enviados++;
        } catch(err){
          console.warn('[registro] falha no anexo:', err.message);
          toast(`Anexo ${enviados + 1} falhou: ${err.message}`, 'amber');
        }
        btn.textContent = `Enviando anexos (${enviados}/${anexos.length})…`;
      }
    }

    /* Limpa previews */
    (state.draft.anexosPendentes || []).forEach(a => {
      if(a.preview) try { URL.revokeObjectURL(a.preview); } catch(_){}
    });

    toast(
      modo === 'encerrar'
        ? 'Parada encerrada com sucesso'
        : `Parada #${parada.numero} registrada`,
      'success'
    );

    state.draft = novoDraft();
    navigate('radar');

  } catch(err){
    console.error('[registro] erro ao salvar:', err);
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