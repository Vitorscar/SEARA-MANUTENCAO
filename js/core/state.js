import { api } from '../data/api.js';
import { toast } from '../ui/toast.js';

export const state = {
  db: null,
  draft: novoDraft(),
  currentView: 'radar',
  lastSetor: '',
  qrStream: null, qrLoopId: null,
  reconhecimento: null, ditando: false,
  draggedOSId: null,
  ultimaAcao: null, undoTimer: null,
  filtros: {
    relatorios: { periodo:'30d', tecnicoId:'', maquinaId:'', turno:'', categoria:'' },
    equipe:     { status:'', especialidade:'' }
  }
};

export function novoDraft(){
  return {
    categoria:null, subcausa:null,
    acaoComponente:null, acaoPreventiva:null,
    impacto:'Alto', foto:null,
    anexos:[],
    paradaEditando:null, modo:'novo'
  };
}

export function initState(){
  state.db = api.load();
  state.lastSetor = localStorage.getItem('ultimoSetor') || '';
  if(!state.db.currentUser){
    state.db.currentUser = { id:'u1', nome:'Carlos Andrade', role:'admin' };
  }
}

export function salvarDB(){
  const ok = api.save(state.db);
  if(!ok) toast('Armazenamento cheio — remova fotos antigas.', 'red');
}

export function getMaquina(id){ return state.db.maquinas.find(m => m.id === id); }
export function getTecnico(id){ return state.db.tecnicos.find(t => t.id === id); }

/* ---------- Permissões ---------- */
export function isAdmin(){
  return state.db.currentUser?.role === 'admin';
}

/* ---------- Status derivado do técnico ---------- */
export function statusTecnico(tecnicoId){
  const ativa = state.db.os.find(o =>
    o.tecnicoId === tecnicoId && o.coluna !== 'concluido'
  );
  if(ativa){
    const p = state.db.paradas.find(p => p.id === ativa.paradaId);
    const m = p ? getMaquina(p.maquinaId) : null;
    return {
      status:'atendendo',
      maquina: m?.nome || null,
      paradaId: p?.id || null,
      desde: p?.horaInicio || null
    };
  }
  return { status:'disponivel', maquina:null, paradaId:null, desde:null };
}