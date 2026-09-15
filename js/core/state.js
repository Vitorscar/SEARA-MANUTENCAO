/* =========================================================
   state.js — estado global + helpers
   ========================================================= */

import { api } from '../data/api.js';
import { toast } from '../ui/toast.js';

/* =========================================================
   ESTADO
   ========================================================= */
export const state = {
  db: null,
  draft: novoDraft(),
  currentView: 'radar',
  currentParams: null,
  tecnicoAtualId: null,
  lastSetor: '',

  /* efêmeros */
  qrStream: null,
  qrLoopId: null,
  reconhecimento: null,
  ditando: false,
  draggedOSId: null,
  ultimaAcao: null,
  undoTimer: null,

  filtros: {
    relatorios: { periodo: '30d', tecnicoId: '', maquinaId: '', turno: '', categoria: '' },
    equipe: { status: '', especialidade: '' }
  }
};

/* =========================================================
   DRAFT (formulário em construção)
   ========================================================= */
export function novoDraft() {
  return {
    categoria: null, 
    subcausa: null,
    acaoComponente: null, 
    acaoPreventiva: null,
    impacto: 'Alto',
    foto: null,
    anexos: [],
    paradaEditando: null,
    modo: 'novo'
  };
}

/* =========================================================
   INIT — com validação de sessão
   ========================================================= */
export async function initState(){
  const dados = await api.load();
  state.db = dados;

  /* Garantir estrutura mínima */
  state.db.maquinas      = Array.isArray(state.db.maquinas)      ? state.db.maquinas      : [];
  state.db.tecnicos      = Array.isArray(state.db.tecnicos)      ? state.db.tecnicos      : [];
  state.db.paradas       = Array.isArray(state.db.paradas)       ? state.db.paradas       : [];
  state.db.os            = Array.isArray(state.db.os)            ? state.db.os            : [];
  state.db.usuarios      = Array.isArray(state.db.usuarios)      ? state.db.usuarios      : [];
  state.db.equipamentosDescobertos = state.db.equipamentosDescobertos || {};
  state.db.seqParada     = state.db.seqParada || 1;

  /* ══════════════════════════════════════════════════
     RESTAURAR SESSÃO DO localStorage
     ══════════════════════════════════════════════════ */
  const SESSION_KEY = 'seara_sessao_v1';
  let sessao = null;

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if(raw){
      const s = JSON.parse(raw);
      /* Só restaura se ainda não expirou */
      if(s?.expiraEm && s.expiraEm > Date.now()){
        sessao = s;
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  } catch(e){
    sessao = null;
  }

  /* Se há sessão válida E o cache tem o currentUser, restaura */
  if(sessao && state.db.currentUser){
    /* já está lá */
  } else if(sessao){
    /* Reconstrói o currentUser a partir da lista de técnicos */
    const user = (state.db.tecnicos || []).find(t => t.id === sessao.userId);
    if(user){
      state.db.currentUser = {
        id:            user.id,
        nome:          user.nome,
        chapa:         user.chapa,
        turno:         user.turno,
        especialidade: user.especialidade,
        role:          user.role,
        loginEm:       new Date(sessao.iniciadaEm || Date.now()).toISOString()
      };
    } else {
      /* Sessão órfã (usuário não existe mais) → limpa */
      localStorage.removeItem(SESSION_KEY);
      state.db.currentUser = null;
    }
  } else {
    state.db.currentUser = null;
  }

  state.db.sessao = sessao;
  state.lastSetor = localStorage.getItem('ultimoSetor') || '';
  window.__state = state;

  console.log('[initState] pronto:', {
    logado: !!state.db.currentUser,
    user: state.db.currentUser?.nome || null,
    maquinas: state.db.maquinas.length,
    tecnicos: state.db.tecnicos.length
  });
}

/* =========================================================
   PERSISTÊNCIA
   ========================================================= */
export function salvarDB() {
  const ok = api.save(state.db);
  if (!ok) toast('Armazenamento cheio — remova fotos antigas.', 'red');
}

/* =========================================================
   LOOKUPS
   ========================================================= */
export function getMaquina(id) {
  return (state.db?.maquinas || []).find(m => m.id === id);
}

export function getTecnico(id) {
  return (state.db?.tecnicos || []).find(t => t.id === id);
}

/* =========================================================
   PERMISSÕES
   ========================================================= */
export function isAdmin() {
  return state.db?.currentUser?.role === 'admin';
}

export function usuarioEAdmin() {
  return state.db?.currentUser?.role === 'admin';
}

export function usuarioSupervisor() {
  return state.db?.currentUser?.role === 'supervisor';
}

export function usuarioLogado() {
  return state.db?.currentUser || null;
}

/* =========================================================
   STATUS DO TÉCNICO — derivado da OS ativa
   ========================================================= */
import { estadoTurnoFuncionario } from '../services/turno.service.js';

export function statusTecnico(tecnicoId){
  const t = (state.db?.tecnicos || []).find(x => x.id === tecnicoId);
  if(!t) return { status:'offline', maquina:null, paradaId:null, desde:null };

  /* ---------- 1) Está atendendo algo AGORA? ---------- */
  const ativa = (state.db?.os || []).find(o =>
    o.tecnicoId === tecnicoId && o.coluna !== 'concluido'
  );

  if(ativa){
    const p = (state.db?.paradas || []).find(p => p.id === ativa.paradaId);
    const m = p ? getMaquina(p.maquinaId) : null;
    return {
      status:'atendendo',
      maquina: m?.nome || null,
      paradaId: p?.id || null,
      desde: p?.horaInicio || null,
      turnoEstado: estadoTurnoFuncionario(t.turno)
    };
  }

  /* ---------- 2) Sem tarefa → depende do turno ---------- */
  const turnoEstado = estadoTurnoFuncionario(t.turno);

  return {
    status: turnoEstado === 'ativo' ? 'disponivel'
          : turnoEstado === 'encerrado' ? 'turno_encerrado'
          : turnoEstado === 'nao_iniciado' ? 'turno_nao_iniciado'
          : 'offline',
    maquina: null,
    paradaId: null,
    desde: null,
    turnoEstado
  };
}