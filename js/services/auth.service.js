/* =========================================================
   auth.service.js — login por chapa + admin (SGA)
   - Login via Supabase (RPC)
   - Fallback para cache local se estiver offline
   - SEM validação de turno
   - Sessão persistente em localStorage
   ========================================================= */

import { state, salvarDB } from '../core/state.js';
import { CHAPA_REGEX, MSG } from '../data/turnos.js';
import { api }             from '../data/api.js';

const SESSION_KEY = 'seara_sessao_v1';
const DURACAO_H   = 12;   // horas até expirar

/* =========================================================
   LOGIN POR CHAPA (funcionário)
   ========================================================= */
export async function loginPorChapa(chapaRaw){
  const chapa = String(chapaRaw || '').replace(/\D/g, '');

  /* 1) Validação de formato */
  if(!CHAPA_REGEX.test(chapa)){
    throw new Error(MSG.CHAPA_INVALIDA);
  }

  /* 2) Tenta Supabase primeiro */
  let func = null;

  try {
    if(navigator.onLine){
      const res = await api.auth.loginChapa(chapa);
      if(res?.ok && res.funcionario){
        func = res.funcionario;
      } else if(res?.erro === 'CHAPA_INVALIDA'){
        throw new Error(MSG.CHAPA_INVALIDA);
      } else if(res?.erro === 'NAO_ENCONTRADO'){
        throw new Error(MSG.NAO_ENCONTRADO);
      } else if(res?.erro === 'INATIVO'){
        throw new Error(MSG.INATIVO);
      } else {
        throw new Error(res?.msg || 'Acesso negado.');
      }
    }
  } catch(err){
    /* Erros de rede → tenta cache local */
    if(!navigator.onLine){
      console.warn('[auth] offline — usando cache local');
    } else if(err.message === MSG.CHAPA_INVALIDA ||
              err.message === MSG.NAO_ENCONTRADO ||
              err.message === MSG.INATIVO){
      /* Erros de negócio → propaga direto */
      throw err;
    } else {
      console.warn('[auth] Supabase falhou, tentando cache:', err.message);
    }
  }

  /* 3) Fallback: busca no cache local */
  if(!func){
    func = (state.db?.tecnicos || []).find(t => t.chapa === chapa);
    if(!func) throw new Error(MSG.NAO_ENCONTRADO);
    if(func.ativo === false) throw new Error(MSG.INATIVO);
  }

  /* 4) Monta usuário e abre sessão */
  const user = {
    id:            func.id,
    nome:          func.nome,
    chapa:         func.chapa,
    matricula:     func.matricula || func.chapa,
    especialidade: func.especialidade || 'Multifuncional',
    turno:         func.turno || null,
    role:          func.role || 'tecnico',
    loginEm:       new Date().toISOString()
  };

  abrirSessao(user);
  return user;
}

/* =========================================================
   LOGIN ADMIN (SGA)
   ========================================================= */
export async function loginAdmin(login, senha){
  const id = String(login || '').trim();
  if(!id)    throw new Error('Informe o login.');
  if(!senha) throw new Error('Informe a senha.');

  let adm = null;

  /* 1) Tenta Supabase */
  try {
    if(navigator.onLine){
      const res = await api.auth.loginAdmin(id, senha);
      if(res?.ok && res.funcionario){
        adm = res.funcionario;
      } else {
        throw new Error(res?.msg || 'Credenciais inválidas.');
      }
    }
  } catch(err){
    if(!navigator.onLine){
      console.warn('[auth] offline — usando admin local');
    } else if(err.message.includes('não cadastrado') ||
              err.message.includes('incorreta')){
      throw err;
    } else {
      console.warn('[auth] Supabase falhou, tentando local:', err.message);
    }
  }

  /* 2) Fallback: admin local (SGA/123456) */
  if(!adm){
    const ADMINS = [
      { id:'sga', nome:'SGA', email:'SGA', senha:'123456',
        role:'admin', especialidade:'Administrador' }
    ];
    const found = ADMINS.find(a =>
      a.email.toLowerCase() === id.toLowerCase() ||
      a.nome.toLowerCase()  === id.toLowerCase()
    );
    if(!found) throw new Error('Login não cadastrado.');
    if(found.senha !== senha) throw new Error('Senha incorreta.');
    adm = found;
  }

  /* 3) Monta usuário e abre sessão */
  const user = {
    id:            adm.id,
    nome:          adm.nome,
    email:         adm.email || null,
    chapa:         adm.chapa || null,
    role:          adm.role || 'admin',
    especialidade: adm.especialidade || 'Administrador',
    turno:         null,
    loginEm:       new Date().toISOString()
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
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state.db.sessao));
  } catch(e){}
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
  } catch(e){
    return null;
  }
}

export function estaLogado(){
  return !!state.db?.currentUser && !!sessaoAtiva();
}

export function roleAtual(){
  return state.db?.currentUser?.role || null;
}

export function ehAdmin(){
  return roleAtual() === 'admin';
}