/* =========================================================
   auth.service.js — login por chapa com validação de turno
   ========================================================= */

import { state, salvarDB } from '../core/state.js';
import { CHAPA_REGEX, MSG } from '../data/turnos.js';
import { dentroDoTurno, horaServidor, proximaJanela } from './turno.service.js';

const SESSION_KEY = 'seara_sessao_v1';
const DURACAO_H   = 12;   // horas até expirar

/* =========================================================
   LOGIN PRINCIPAL — por chapa (9 dígitos)
   ========================================================= */
export async function loginPorChapa(chapaRaw){
  const chapa = String(chapaRaw || '').replace(/\D/g, '');
/* Adicione no início da função loginPorChapa, logo após o replace */

  /* 1) Validação de formato */
  if(!CHAPA_REGEX.test(chapa)){
    throw new Error(MSG.CHAPA_INVALIDA);
  }

  /* 2) Busca funcionário */
  const func = (state.db.tecnicos || []).find(t => t.chapa === chapa);

  if(!func){
    throw new Error(MSG.NAO_ENCONTRADO);
  }
  if(func.ativo === false){
    throw new Error(MSG.INATIVO);
  }
  if(!func.turno){
    throw new Error(MSG.SEM_TURNO);
  }

  /* 3) Validação de turno com hora do servidor */
  const agora = horaServidor();
  const check = dentroDoTurno(func.turno, agora);

  if(!check.ok){
    const prox = proximaJanela(func.turno);
    const proxStr = prox?.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const err = new Error(MSG.FORA_TURNO);
    err.detalhe = `Seu turno (${func.turno}) é ${check.janela}. Retorne às ${proxStr}.`;
    throw err;
  }

  /* 4) Abre sessão */
  const user = {
    id:            func.id,
    nome:          func.nome,
    chapa:         func.chapa,
    matricula:     func.matricula,
    especialidade: func.especialidade,
    turno:         func.turno,
    role:          func.role || 'tecnico',
    loginEm:       agora.toISOString()
  };
  abrirSessao(user);
  return user;
}

/* =========================================================
   LOGIN ADMIN — SGA/123456 (acesso irrestrito de horário)
   ========================================================= */
const ADMINS = [
  { id:'sga',  nome:'SGA', email:'SGA', senha:'123456',
    role:'admin', especialidade:'Administrador' }
];

export function loginAdmin(login, senha){
  const id = String(login || '').trim().toLowerCase();
  if(!id) throw new Error('Informe o login.');
  if(!senha) throw new Error('Informe a senha.');

  const adm = ADMINS.find(a =>
    a.email.toLowerCase() === id || a.nome.toLowerCase() === id
  );
  if(!adm) throw new Error('Login não cadastrado.');
  if(adm.senha !== senha) throw new Error('Senha incorreta.');

  const user = {
    id: adm.id, nome: adm.nome, email: adm.email,
    role: adm.role, especialidade: adm.especialidade,
    turno: null, loginEm: new Date().toISOString()
  };
  abrirSessao(user);
  return user;
}

/* =========================================================
   SESSÃO
   ========================================================= */
function abrirSessao(user){
  state.db.currentUser = user;
  state.db.sessao = {
    userId:     user.id,
    role:       user.role,
    iniciadaEm: Date.now(),
    expiraEm:   Date.now() + DURACAO_H * 60 * 60 * 1000
  };
  salvarDB();
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state.db.sessao)); } catch(e){}
}

export function logout(){
  state.db.currentUser = null;
  state.db.sessao = null;
  salvarDB();
  try { localStorage.removeItem(SESSION_KEY); } catch(e){}
  location.reload();
}

export function sessaoAtiva(){
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s?.expiraEm || s.expiraEm < Date.now()){
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch(e){ return null; }
}

export function estaLogado(){
  return !!state.db?.currentUser && !!sessaoAtiva();
}

export function roleAtual(){ return state.db?.currentUser?.role || null; }
export function ehAdmin(){ return roleAtual() === 'admin'; }

/* =========================================================
   Revalidação contínua (opcional)
   Chamada a cada 5 min para expulsar quem saiu do turno
   ========================================================= */
export function revalidarTurno(){
  const user = state.db?.currentUser;
  if(!user || user.role === 'admin' || !user.turno) return true;

  const check = dentroDoTurno(user.turno, horaServidor());
  if(!check.ok){
    logout();
    return false;
  }
  return true;
}