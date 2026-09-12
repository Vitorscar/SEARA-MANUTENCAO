/* =========================================================
   equipe.service.js — CRUD de funcionários e direcionamento
   ========================================================= */
import { state, salvarDB, getMaquina } from '../core/state.js';
import { emit } from '../core/events.js';
import { api } from '../data/api.js';
import { CHAPA_REGEX } from '../data/turnos.js';

/* =========================================================
   DIRECIONAR TÉCNICOS (Fluxo principal do Radar)
   ========================================================= */
export async function direcionarTecnicos({ maquinaId, tecnicoIds, paradaId, observacao }){
  if(!tecnicoIds || tecnicoIds.length === 0){
    throw new Error('Selecione pelo menos um técnico.');
  }
  if(!paradaId){
    throw new Error('ID da parada é obrigatório para direcionamento.');
  }

  const tecnicoPrincipal = tecnicoIds[0];

  /* ---------- 1) Atualiza parada ---------- */
  const p = state.db.paradas.find(x => x.id === paradaId);
  if(p){
    p.status = 'atendendo';
    p.tecnicoId = tecnicoPrincipal;
    if(observacao){
      p.observacao = p.observacao ? `${p.observacao} | ${observacao}` : observacao;
    }
  }

  /* ---------- 2) Atualiza ou cria OS ---------- */
  let os = state.db.os.find(o => o.paradaId === paradaId);
  if(os){
    os.coluna = 'andamento';
    os.tecnicoId = tecnicoPrincipal;
  } else {
    state.db.os.push({
      id: 'os' + Date.now(),
      paradaId: paradaId,
      maquinaId: maquinaId,
      titulo: observacao || 'Atendimento',
      coluna: 'andamento',
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
export async function criarTecnico({ nome, chapa, turno, especialidade, role = 'tecnico' }){
  /* ---------- Validações locais ---------- */
  const nomeLimpo  = String(nome || '').trim();
  const chapaLimpa = String(chapa || '').replace(/\D/g, '');
  const turnoLimpo = String(turno || '').trim();

  if(!nomeLimpo) throw new Error('Informe o nome completo.');
  if(!/^\d{9}$/.test(chapaLimpa)) throw new Error('A chapa deve ter exatamente 9 dígitos numéricos.');
  if(!turnoLimpo) throw new Error('Selecione o turno.');

  /* Duplicata no cache local */
  const jaExiste = (state.db.tecnicos || []).some(t => t.chapa === chapaLimpa);
  if(jaExiste) throw new Error(`A chapa ${chapaLimpa} já está cadastrada.`);

  /* ---------- Grava no Supabase via RPC ---------- */
  let funcionario;
  try {
    funcionario = await api.cadastrarFuncionario({
      nome:          nomeLimpo,
      chapa:         chapaLimpa,
      turno:         turnoLimpo,
      especialidade: especialidade || 'Multifuncional',
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
    role:          funcionario.role,
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
    if(!CHAPA_REGEX.test(c)) throw new Error('Chapa inválida (deve ter 9 dígitos).');

    const conflito = state.db.tecnicos.some(x => x.id !== id && x.chapa === c);
    if(conflito) throw new Error(`A chapa ${c} já está em uso por outro funcionário.`);

    patch.chapa = c;
    patch.matricula = c;
  }

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
   DIRECIONAR PARA PARADA (individual)
   ========================================================= */
export function direcionarParaParada(tecnicoId, paradaId){
  const parada  = (state.db.paradas  || []).find(p => p.id === paradaId);
  const tecnico = (state.db.tecnicos || []).find(t => t.id === tecnicoId);

  if(!parada || !tecnico) throw new Error('Parada ou Técnico não encontrado.');

  parada.status = 'atendendo';
  parada.tecnicoId = tecnicoId;

  const os = (state.db.os || []).find(o => o.paradaId === paradaId);
  if(os){ os.coluna = 'andamento'; os.tecnicoId = tecnicoId; }

  salvarDB();
  emit('tecnico:direcionado', { tecnicoId, paradaId });
  return parada;
}

/* =========================================================
   ESTATÍSTICAS
   ========================================================= */
export function getEstatisticasTecnico(tecnicoId){
  const paradas = (state.db.paradas || []).filter(p => p.tecnicoId === tecnicoId);
  const encerradas = paradas.filter(p => p.status === 'encerrada');

  const mttr = encerradas.length
    ? Math.round(encerradas.reduce((s, p) => s + (p.duracaoMin || 0), 0) / encerradas.length)
    : 0;

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  const hojeEnc = encerradas.filter(p => {
    if(!p.horaFim) return false;
    const d = new Date(p.horaFim);
    const fimStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return fimStr === hojeStr;
  });

  return { total: paradas.length, hoje: hojeEnc.length, mttr };
}