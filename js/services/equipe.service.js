/* =========================================================
   equipe.service.js — CRUD de funcionários + direcionamento
   ========================================================= */

import { state, salvarDB, getMaquina } from '../core/state.js';
import { emit }                        from '../core/events.js';
import { api }                         from '../data/api.js';
import { CHAPA_REGEX }                 from '../data/turnos.js';

/* =========================================================
   DIRECIONAR TÉCNICOS (multi)
   paradaId agora é OPCIONAL (permite só "registrar OS")
   ========================================================= */
export async function direcionarTecnicos({ maquinaId, tecnicoIds, paradaId = null, observacao }){

  if(!tecnicoIds || tecnicoIds.length === 0){
    throw new Error('Selecione pelo menos um técnico.');
  }
  if(!maquinaId){
    throw new Error('Selecione a máquina.');
  }

  const tecnicoPrincipal = tecnicoIds[0];

  /* ---------- 1) Se há parada vinculada, atualiza ---------- */
  if(paradaId){
    const p = (state.db.paradas || []).find(x => x.id === paradaId);
    if(p){
      p.status = 'atendendo';
      p.tecnicoId = tecnicoPrincipal;
      if(observacao){
        p.observacao = p.observacao
          ? `${p.observacao} | ${observacao}`
          : observacao;
      }
    }
  }

  /* ---------- 2) Atualiza ou cria OS ---------- */
  state.db.os = state.db.os || [];
  let os = paradaId
    ? state.db.os.find(o => o.paradaId === paradaId)
    : null;

  if(os){
    os.coluna    = 'andamento';
    os.tecnicoId = tecnicoPrincipal;
  } else {
    state.db.os.push({
      id:        'os' + Date.now(),
      paradaId:  paradaId || null,
      maquinaId: maquinaId,
      titulo:    observacao || 'Atendimento',
      coluna:    'andamento',
      tecnicoId: tecnicoPrincipal
    });
  }

  salvarDB();
  emit('direcionamento:criado', { paradaId, tecnicoIds });

  return { success: true, paradaId, tecnicoIds };
}

/* =========================================================
   CRIAR FUNCIONÁRIO
   ========================================================= */
export async function criarTecnico({ nome, chapa, turno, especialidade, gestor, role = 'tecnico' }){

  /* ---------- Validações ---------- */
  const nomeLimpo   = String(nome          || '').trim();
  const chapaLimpa  = String(chapa         || '').replace(/\D/g, '');
  const turnoLimpo  = String(turno         || '').trim();
  const espLimpa    = String(especialidade || '').trim();
  const gestorLimpo = String(gestor        || '').trim();

  if(!nomeLimpo)                   throw new Error('Informe o nome completo.');
  if(!/^\d{10}$/.test(chapaLimpa))  throw new Error('A chapa deve ter exatamente 10 dígitos numéricos.');
  if(!turnoLimpo)                  throw new Error('Selecione o turno.');
  if(!espLimpa)                    throw new Error('Selecione o cargo.');

  /* Duplicata no cache local */
  const jaExiste = (state.db.tecnicos || []).some(t => t.chapa === chapaLimpa);
  if(jaExiste) throw new Error(`A chapa ${chapaLimpa} já está cadastrada.`);

  /* ---------- Grava no Supabase via RPC ---------- */
  let funcionario;
  try {
    funcionario = await api.usuarios.cadastrar({
      nome:          nomeLimpo,
      chapa:         chapaLimpa,
      turno:         turnoLimpo,
      especialidade: espLimpa,
      gestor:        gestorLimpo,
      role
    });
    console.log('[equipe] Supabase criou:', funcionario);
  } catch(err){
    console.error('[equipe] Supabase falhou:', err.message);
    throw new Error('Falha ao salvar no banco: ' + err.message);
  }

  /* ---------- Atualiza cache local ---------- */
  const t = {
    id:            funcionario.id,
    nome:          funcionario.nome,
    chapa:         funcionario.chapa,
    matricula:     funcionario.chapa,
    turno:         funcionario.turno,
    especialidade: funcionario.especialidade,
    gestor:        funcionario.gestor || gestorLimpo,
    role:          funcionario.role || role,
    ativo:         true
  };
  state.db.tecnicos = state.db.tecnicos || [];
  state.db.tecnicos.push(t);
  salvarDB();
  emit('tecnico:criado', t);
  return t;
}

/* =========================================================
   ATUALIZAR
   ========================================================= */
export function atualizarTecnico(id, patch){
  const t = (state.db.tecnicos || []).find(x => x.id === id);
  if(!t) throw new Error('Técnico não encontrado.');

  /* Se mudou chapa, valida */
  if(patch.chapa && patch.chapa !== t.chapa){
    const c = String(patch.chapa).replace(/\D/g, '');
    if(!/^\d{10}$/.test(c)) throw new Error('Chapa inválida (deve ter 10 dígitos).');

    const conflito = state.db.tecnicos.some(x => x.id !== id && x.chapa === c);
    if(conflito) throw new Error(`A chapa ${c} já está em uso por outro funcionário.`);

    patch.chapa = c;
    patch.matricula = c;
  }

  /* Bloqueia campos que não devem ser sobrescritos */
  const { id: _, criadoEm, ...safePatch } = patch;
  Object.assign(t, safePatch);

  salvarDB();
  emit('tecnico:atualizado', t);
  return t;
}

/* =========================================================
   DESATIVAR / REATIVAR
   ========================================================= */
export function desativarTecnico(id){
  const t = (state.db.tecnicos || []).find(x => x.id === id);
  if(!t) return null;
  t.ativo = false;
  salvarDB();
  emit('tecnico:desativado', t);
  return t;
}

export function reativarTecnico(id){
  const t = (state.db.tecnicos || []).find(x => x.id === id);
  if(!t) return null;
  t.ativo = true;
  salvarDB();
  emit('tecnico:reativado', t);
  return t;
}

/* =========================================================
   DIRECIONAR PARA PARADA (individual — ainda usado no Radar)
   ========================================================= */
export function direcionarParaParada(tecnicoId, paradaId){
  const parada  = (state.db.paradas  || []).find(p => p.id === paradaId);
  const tecnico = (state.db.tecnicos || []).find(t => t.id === tecnicoId);

  if(!parada || !tecnico) throw new Error('Parada ou Técnico não encontrado.');

  parada.status    = 'atendendo';
  parada.tecnicoId = tecnicoId;

  const os = (state.db.os || []).find(o => o.paradaId === paradaId);
  if(os){
    os.coluna    = 'andamento';
    os.tecnicoId = tecnicoId;
  }

  salvarDB();
  emit('tecnico:direcionado', { tecnicoId, paradaId });
  return parada;
}

/* =========================================================
   ESTATÍSTICAS
   ========================================================= */
export function getEstatisticasTecnico(tecnicoId){
  const paradas    = (state.db.paradas || []).filter(p => p.tecnicoId === tecnicoId);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  const mttr = encerradas.length
    ? Math.round(
        encerradas.reduce((s, p) => s + (p.duracaoMin || 0), 0) / encerradas.length
      )
    : 0;

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${
    String(hoje.getMonth() + 1).padStart(2, '0')}-${
    String(hoje.getDate()).padStart(2, '0')}`;

  const hojeEnc = encerradas.filter(p => {
    if(!p.horaFim) return false;
    const d = new Date(p.horaFim);
    const fimStr = `${d.getFullYear()}-${
      String(d.getMonth() + 1).padStart(2, '0')}-${
      String(d.getDate()).padStart(2, '0')}`;
    return fimStr === hojeStr;
  });

  return {
    total: paradas.length,
    hoje:  hojeEnc.length,
    mttr
  };
}