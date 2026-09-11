/* =========================================================
   registro.view.js — formulário de registro / correção
   ========================================================= */

import { state, novoDraft, getMaquina, salvarDB } from '../core/state.js';
import { navigate } from '../core/router.js';
import { openModal, closeModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { registrarDesfazer } from '../ui/undo.js';
import { criarParada, atualizarParada } from '../services/paradas.service.js';
import { toggleDitado } from '../services/voz.service.js';
import { alertaCritico } from '../services/audio.service.js';
import { escapeHtml, turnoAtual } from '../core/utils.js';
import { SUBCAUSAS, SETORES, COMPONENTES_SUG, IMPACTOS, TURNOS } from '../data/constants.js';
import { optionsFrom, datalist } from '../components/form-fields.js';

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
   VIEW
   ========================================================= */
export function renderRegistro(){
  const p = state.draft.paradaEditando
    ? state.db.paradas.find(x => x.id === state.draft.paradaEditando)
    : null;

  const horaInicio = p ? new Date(p.horaInicio) : new Date();
  const dataStr = horaInicio.toISOString().slice(0,10);
  const titulo = p
    ? (state.draft.modo === 'encerrar' ? 'Encerrar parada #'+p.numero : 'Corrigir registro #'+p.numero)
    : 'Registrar nova parada';
  const labelBotao = state.draft.modo === 'encerrar' ? 'Confirmar retorno'
                    : p ? 'Salvar correção'
                    : 'Registrar parada';

  document.getElementById('view').innerHTML = `
    <div class="section-head"><h2>${titulo}</h2></div>

    <!-- Identificação -->
    <div class="form-card">
      <div class="head"><span class="dot"></span><h3>Identificação da ocorrência</h3></div>
      <div class="body">
        <div class="field-grid cols-5">
          <div class="field"><label>Data</label><input type="date" id="fData" value="${dataStr}" ${p?'disabled':''}></div>
          <div class="field"><label>Setor</label>
            <select id="fSetor">
              <option value="">Selecione…</option>
              ${optionsFrom(SETORES, p?.setor || state.lastSetor)}
            </select>
          </div>
          <div class="field"><label>Turno (SS)</label>
            <select id="fTurno">${optionsFrom(TURNOS, p?.turno || turnoAtual())}</select>
          </div>
          <div class="field"><label>Duração (min)</label><input type="number" id="fDuracao" min="1" placeholder="Ex: 45" value="${p?.duracaoMin || ''}"></div>
          <div class="field"><label>Impacto</label>
            <select id="fImpacto">${optionsFrom(IMPACTOS, p?.impacto || state.draft.impacto)}</select>
          </div>
        </div>
      </div>
    </div>

    <!-- Máquina -->
    <div class="form-card">
      <div class="head"><span class="dot"></span><h3>Máquina</h3></div>
      <div class="body">
        <div class="field">
          <label>Máquina</label>
          <div class="with-btn">
            <input type="text" id="fMaquina" list="listaMaquinas" placeholder="Nome ou escaneie o QR…" value="${escapeHtml(p ? (getMaquina(p.maquinaId)?.nome || '') : '')}" autocomplete="off">
            <button type="button" class="icon-btn" onclick="abrirQR()" title="Escanear QR">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>
            </button>
          </div>
          ${datalist('listaMaquinas', state.db.maquinas.map(m => m.nome))}
        </div>
      </div>
    </div>

    <!-- Split: Tipo de falha + Ação -->
    <div style="display:grid; grid-template-columns:1fr; gap:14px;" id="splitContainer">

      <!-- Tipo de falha -->
      <div class="form-card">
        <div class="head" style="background:var(--sun-dim); border-bottom-color:var(--sun);">
          <span class="dot" style="background:var(--sun-dark);"></span><h3>Tipo de falha</h3>
        </div>
        <div class="body">
          <label style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; display:block; margin-bottom:6px;">Categoria</label>
          <div class="cat-grid" id="catGrid">
            ${Object.keys(SUBCAUSAS).map(c => {
              const active = (p?.categoria || state.draft.categoria) === c;
              return `<button type="button" class="cat-btn ${active?'active':''} ${c==='Projeto'?'proj':''}" data-cat="${c}">
                ${c}<small>${SUBCAUSAS[c].slice(0,2).join(', ')}…</small>
              </button>`;
            }).join('')}
          </div>

          <div id="subcausaWrap" class="hidden">
            <label style="font-size:11.5px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; display:block; margin:14px 0 6px;">Subcausa específica</label>
            <div class="chips" id="subcausas"></div>
          </div>

          <div class="field" style="margin-top:14px;">
            <label>Nome do componente</label>
            <input type="text" id="fComponente" list="listaComponentes" placeholder="Ex: Rolamento 6205" value="${escapeHtml(p?.componente || '')}" autocomplete="off">
            ${datalist('listaComponentes', COMPONENTES_SUG)}
          </div>

          <div class="field" style="margin-top:12px;">
            <label>Causa raiz (detalhe)</label>
            <div class="with-btn">
              <textarea id="fCausaRaiz" placeholder="Descreva o motivo principal da falha">${escapeHtml(p?.causaRaiz || '')}</textarea>
              <button type="button" class="icon-btn" id="btnMic" onclick="toggleDitado()" title="Ditar por voz">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
              </button>
            </div>
          </div>

          <!-- ============= ANEXOS ============= -->
          <div class="field" style="margin-top:14px;">
            <label>Anexos da ocorrência</label>

            <div class="anexos-botoes">
              <button type="button" class="anexo-btn" onclick="document.getElementById('fFotoInput').click()">
                <span class="anexo-ic">📷</span>
                <span class="anexo-lbl">Foto</span>
              </button>
              <button type="button" class="anexo-btn" id="btnGravarAudio" onclick="toggleAudio()">
                <span class="anexo-ic" id="audioIc">🎤</span>
                <span class="anexo-lbl" id="audioLbl">Áudio</span>
              </button>
              <button type="button" class="anexo-btn" onclick="document.getElementById('fVideoInput').click()">
                <span class="anexo-ic">🎥</span>
                <span class="anexo-lbl">Vídeo</span>
              </button>
            </div>

            <input type="file" id="fFotoInput"  accept="image/*" capture="environment" style="display:none" onchange="onFoto(event)">
            <input type="file" id="fVideoInput" accept="video/*" capture="environment" style="display:none" onchange="onVideo(event)">

            <div id="audioStatus" class="audio-status hidden">
              <span class="audio-rec-dot"></span>
              <span>Gravando… <b id="audioTimer">0s</b> / 45s</span>
              <button type="button" class="audio-stop" onclick="toggleAudio()">Parar</button>
            </div>

            <div id="listaAnexos" class="anexos-lista"></div>
            <div id="pesoAnexos" class="anexos-peso hidden"></div>
          </div>
          <!-- ============= /ANEXOS ============= -->
        </div>
      </div>

      <!-- Ação -->
      <div class="form-card">
        <div class="head" style="background:var(--green-dim); border-bottom-color:#C8E0D0;">
          <span class="dot" style="background:var(--green);"></span><h3>Ação realizada</h3>
        </div>
        <div class="body">
          <div class="field">
            <label>Ação no componente</label>
            <div class="radio-row three" id="acaoCompGrid">
              <div class="radio-opt ${(p?.acaoComponente || state.draft.acaoComponente)==='Adaptado'?'active':''}" data-val="Adaptado">Adaptado</div>
              <div class="radio-opt ${(p?.acaoComponente || state.draft.acaoComponente)==='Conserto'?'active':''}" data-val="Conserto">Conserto</div>
              <div class="radio-opt ${(p?.acaoComponente || state.draft.acaoComponente)==='Substituído (estoque)'?'active':''}" data-val="Substituído (estoque)">Substituído (estoque)</div>
            </div>
          </div>

          <div class="field" style="margin-top:14px;">
            <label>Ação preventiva</label>
            <div class="radio-row" id="acaoPrevGrid">
              <div class="radio-opt ${(p?.acaoPreventiva || state.draft.acaoPreventiva)==='Item de reserva instalado'?'active':''}" data-val="Item de reserva instalado">Item de reserva</div>
              <div class="radio-opt ${(p?.acaoPreventiva || state.draft.acaoPreventiva)==='Nenhuma'?'active':''}" data-val="Nenhuma">Nenhuma</div>
            </div>
          </div>

          <div class="field" style="margin-top:14px;">
            <label>Responsável</label>
            <input type="text" id="fResponsavel" placeholder="Nome do técnico" value="${escapeHtml(p?.responsavel || localStorage.getItem('tecnicoNome') || '')}">
          </div>

          <div class="field" style="margin-top:12px;">
            <label>Observação (opcional)</label>
            <textarea id="fObservacao" placeholder="Anotações extras">${escapeHtml(p?.observacao || '')}</textarea>
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-top:6px; margin-bottom:10px;">
      <button class="btn block primary" onclick="salvarRegistro()">✅ ${labelBotao}</button>
      <button class="btn block ghost" onclick="cancelarRegistro()">Cancelar</button>
    </div>
  `;

  if(window.innerWidth >= 900){
    document.getElementById('splitContainer').style.gridTemplateColumns = '1fr 1fr';
  }

  wireRegistro();
  renderAnexosLista();
}

/* =========================================================
   WIRING dos campos
   ========================================================= */
function wireRegistro(){
  const grid = document.getElementById('catGrid');
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn'); if(!btn) return;
    [...grid.children].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.draft.categoria = btn.dataset.cat;
    state.draft.subcausa = null;
    renderSubcausas();
    document.getElementById('subcausaWrap').classList.remove('hidden');
  });

  const catInicial = state.draft.paradaEditando
    ? state.db.paradas.find(x => x.id === state.draft.paradaEditando)?.categoria
    : state.draft.categoria;

  if(catInicial){
    state.draft.categoria = catInicial;
    if(state.draft.paradaEditando){
      state.draft.subcausa = state.db.paradas.find(x => x.id === state.draft.paradaEditando)?.subcausa;
    }
    renderSubcausas();
    document.getElementById('subcausaWrap').classList.remove('hidden');
  }

  wireRadio('acaoCompGrid', v => state.draft.acaoComponente = v);
  wireRadio('acaoPrevGrid', v => state.draft.acaoPreventiva = v);

  document.getElementById('fImpacto').onchange = e => {
    state.draft.impacto = e.target.value;
    if(state.draft.impacto === 'Crítico' && navigator.vibrate) navigator.vibrate(80);
  };
}

function renderSubcausas(){
  const cont = document.getElementById('subcausas');
  if(!cont) return;
  cont.innerHTML = '';
  if(!state.draft.categoria) return;
  SUBCAUSAS[state.draft.categoria].forEach(s => {
    const c = document.createElement('div');
    c.className = 'chip-opt' + (state.draft.subcausa === s ? ' active' : '');
    c.textContent = s;
    c.onclick = () => {
      [...cont.children].forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.draft.subcausa = s;
    };
    cont.appendChild(c);
  });
}

function wireRadio(id, setter){
  const el = document.getElementById(id);
  el.addEventListener('click', e => {
    const c = e.target.closest('.radio-opt'); if(!c) return;
    [...el.children].forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    setter(c.dataset.val);
  });
}

/* =========================================================
   Cancelar
   ========================================================= */
export function cancelarRegistro(){
  state.draft = novoDraft();
  navigate('radar');
}

/* =========================================================
   Anexos
   ========================================================= */
export async function onFoto(e){
  const file = e.target.files?.[0]; if(!file) return;
  try {
    const anexo = await processarFoto(file);
    state.draft.anexos = [...(state.draft.anexos || []), anexo];
    e.target.value = '';
    renderAnexosLista();
    toast('Foto anexada', 'green');
  } catch(err){
    toast('Erro ao processar foto', 'red');
  }
}

export async function onVideo(e){
  const file = e.target.files?.[0]; if(!file) return;
  try {
    const anexo = await processarVideo(file);
    state.draft.anexos = [...(state.draft.anexos || []), anexo];
    e.target.value = '';
    renderAnexosLista();
    toast('Vídeo anexado', 'green');
  } catch(err){
    toast(err.message || 'Erro no vídeo', 'red');
  }
}

export async function toggleAudio(){
  if(estaGravando()){ pararGravacao(); return; }

  try {
    document.getElementById('audioStatus').classList.remove('hidden');
    document.getElementById('audioIc').textContent = '⏹';
    document.getElementById('audioLbl').textContent = 'Parar';

    await iniciarGravacao({
      onTick: s => {
        const el = document.getElementById('audioTimer');
        if(el) el.textContent = s + 's';
      },
      onEnd: (anexo, dur) => {
        const st = document.getElementById('audioStatus');
        const ic = document.getElementById('audioIc');
        const lb = document.getElementById('audioLbl');
        if(st) st.classList.add('hidden');
        if(ic) ic.textContent = '🎤';
        if(lb) lb.textContent = 'Áudio';

        if(anexo){
          state.draft.anexos = [...(state.draft.anexos || []), anexo];
          renderAnexosLista();
          toast(`Áudio gravado (${dur}s)`, 'green');
        }
      }
    });
  } catch(err){
    const st = document.getElementById('audioStatus');
    const ic = document.getElementById('audioIc');
    const lb = document.getElementById('audioLbl');
    if(st) st.classList.add('hidden');
    if(ic) ic.textContent = '🎤';
    if(lb) lb.textContent = 'Áudio';
    toast(err.message || 'Não foi possível gravar', 'red');
  }
}

export function removerAnexoItem(ts){
  state.draft.anexos = removerAnexo(state.draft.anexos, ts);
  renderAnexosLista();
}

function renderAnexosLista(){
  const cont = document.getElementById('listaAnexos');
  const peso = document.getElementById('pesoAnexos');
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
          <button type="button" class="anexo-x" onclick="removerAnexoItem(${a.ts})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'video'){
      return `
        <div class="anexo-item">
          <video src="${base64ParaUrl(a.data, a.mime)}" class="anexo-thumb" muted></video>
          <div class="anexo-info">
            <span class="anexo-tag">🎥 Vídeo</span>
            <span class="anexo-size">${formatarPeso(a.tamanho)}</span>
          </div>
          <button type="button" class="anexo-x" onclick="removerAnexoItem(${a.ts})">✕</button>
        </div>
      `;
    }
    if(a.tipo === 'audio'){
      return `
        <div class="anexo-item anexo-audio">
          <div class="anexo-audio-ic">🎤</div>
          <div class="anexo-info">
            <span class="anexo-tag">Áudio · ${a.duracao || 0}s</span>
            <audio controls src="${base64ParaUrl(a.data, a.mime)}" style="height:28px; margin-top:3px; width:100%;"></audio>
          </div>
          <button type="button" class="anexo-x" onclick="removerAnexoItem(${a.ts})">✕</button>
        </div>
      `;
    }
    return '';
  }).join('');

  if(peso){
    const total = pesoAnexos(anexos);
    peso.textContent = `Total: ${formatarPeso(total)} em ${anexos.length} anexo(s)`;
    peso.classList.toggle('hidden', anexos.length === 0);
  }
}

/* =========================================================
   Salvar
   ========================================================= */
export function salvarRegistro(){
  const dados = {
    maquinaNome: document.getElementById('fMaquina').value.trim(),
    setor:       document.getElementById('fSetor').value,
    turno:       document.getElementById('fTurno').value,
    duracao:     document.getElementById('fDuracao').value,
    impacto:     document.getElementById('fImpacto').value,
    componente:  document.getElementById('fComponente').value.trim(),
    causaRaiz:   document.getElementById('fCausaRaiz').value.trim(),
    responsavel: document.getElementById('fResponsavel').value.trim(),
    observacao:  document.getElementById('fObservacao').value.trim(),
    categoria:      state.draft.categoria,
    subcausa:       state.draft.subcausa,
    acaoComponente: state.draft.acaoComponente,
    acaoPreventiva: state.draft.acaoPreventiva,
    foto:           state.draft.foto,
    anexos:         state.draft.anexos || []
  };

  if(!dados.maquinaNome){ toast('Informe a máquina.', 'red'); return; }
  if(!dados.setor){ toast('Selecione o setor.', 'red'); return; }
  if(!dados.categoria){ toast('Selecione o tipo de falha.', 'red'); return; }
  if(!dados.acaoComponente){ toast('Selecione a ação no componente.', 'red'); return; }
  if(!dados.responsavel){ toast('Informe o responsável.', 'red'); return; }

  state.lastSetor = dados.setor;
  localStorage.setItem('ultimoSetor', dados.setor);
  localStorage.setItem('tecnicoNome', dados.responsavel);

  if(state.draft.paradaEditando){
    const p = atualizarParada(state.draft.paradaEditando, dados, {
      encerrar: state.draft.modo === 'encerrar'
    });
    if(p){
      toast(state.draft.modo === 'encerrar'
        ? `Parada #${p.numero} encerrada`
        : `Registro #${p.numero} atualizado`, 'green');
    }
  } else {
    const { parada } = criarParada(dados);
    if(parada.impacto === 'Crítico') alertaCritico();
    toast(`Parada #${parada.numero} registrada · ${dados.maquinaNome}`,
          parada.impacto === 'Crítico' ? 'red' : 'green');

    const idNovo = parada.id;
    registrarDesfazer(`Parada #${parada.numero} registrada`, () => {
      state.db.paradas = state.db.paradas.filter(x => x.id !== idNovo);
      state.db.os      = state.db.os.filter(o => o.paradaId !== idNovo);
      const m = getMaquina(parada.maquinaId); if(m) m.status = 'ok';
    });
  }

  salvarDB();
  state.draft = novoDraft();
  navigate('radar');
}