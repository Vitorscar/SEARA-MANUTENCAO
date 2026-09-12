/* =========================================================
   estrutura.service.js — banco primeiro, árvore como fallback
   ========================================================= */

import { ESTRUTURA } from '../data/estrutura-plantas.js';
import { state, salvarDB } from '../core/state.js';


/* ---------- SETORES ---------- */
export function getSetores(){
  /* Junta: setores do banco + setores da árvore (fallback) */
  const doBanco = [...new Set((state.db.maquinas || [])
    .map(m => m.setor)
    .filter(Boolean))];

  const daArvore = Object.keys(ESTRUTURA);

  return [...new Set([...doBanco, ...daArvore])].sort();
}

/* ---------- ÁREAS ---------- */
export function getAreas(setor){
  if(!setor) return [];

  /* Do banco: áreas distintas do setor */
  const doBanco = [...new Set((state.db.maquinas || [])
    .filter(m => m.setor === setor && m.area)
    .map(m => m.area))];

  /* Da árvore: só se o setor não tem nenhum registro no banco */
  if(doBanco.length === 0 && ESTRUTURA[setor] && !ESTRUTURA[setor]._livre){
    return Object.keys(ESTRUTURA[setor]).filter(k => k !== '_');
  }

  return doBanco.sort();
}

export function setorTemAreas(setor){
  return getAreas(setor).length > 0;
}

/* ---------- EQUIPAMENTOS ---------- */
export function getEquipamentos(setor, area){
  if(!setor) return [];

  /* Do banco */
  const doBanco = (state.db.maquinas || [])
    .filter(m => m.setor === setor && (area ? m.area === area : true))
    .map(m => m.nome);

  if(doBanco.length > 0) return doBanco.sort();

  /* Fallback: árvore hardcoded (usado até o banco popular) */
  if(ESTRUTURA[setor] && !ESTRUTURA[setor]._livre){
    const key = area || '_';
    const bloco = ESTRUTURA[setor][key] || {};
    return Object.keys(bloco);
  }

  /* Industrializador: aprende dinamicamente */
  if(ESTRUTURA[setor]?._livre){
    return (state.db.equipamentosDescobertos?.[setor] || []);
  }

  return [];
}

/* ---------- VARIANTES (não usadas quando vem do banco) ---------- */
export function getVariantes(setor, area, equipamento){
  /* Com o banco populado, cada variante já é uma máquina.
     Este método fica só para compatibilidade com a árvore. */
  if(!setor || !equipamento) return [];
  if(ESTRUTURA[setor] && !ESTRUTURA[setor]._livre){
    const key = area || '_';
    return ESTRUTURA[setor][key]?.[equipamento] || [];
  }
  return [];
}

/* ---------- NOME FINAL ---------- */
export function comporNomeEquipamento(equipamento, variante){
  if(!equipamento) return '';
  /* Se o equipamento já contém " · ", foi escolhido do banco */
  if(equipamento.includes(' · ')) return equipamento;
  return variante ? `${equipamento} · ${variante}` : equipamento;
}

export function comporRotuloCompleto({ setor, area, equipamento, variante }){
  return [setor, area, equipamento, variante].filter(Boolean).join(' · ');
}

/* ---------- SETOR DINÂMICO ---------- */
export function setorEhDinamico(setor){
  if(!setor) return false;
  /* Se o setor tem máquinas no banco, NÃO é dinâmico */
  const temNoBanco = (state.db.maquinas || []).some(m => m.setor === setor);
  if(temNoBanco) return false;
  return ESTRUTURA[setor]?._livre === true;
}

/* ---------- APRENDIZADO ---------- */
export function registrarEquipamentoAprendido(setor, nome){
  if(!setor || !nome) return;
  if(!setorEhDinamico(setor)) return;

  const limpo = nome.trim();
  if(!limpo) return;

  state.db.equipamentosDescobertos = state.db.equipamentosDescobertos || {};
  const lista = state.db.equipamentosDescobertos[setor] =
    state.db.equipamentosDescobertos[setor] || [];

  const norm = normalizar(limpo);
  if(!lista.some(x => normalizar(x) === norm)){
    lista.push(limpo);
    salvarDB();
  }
}

/* ---------- util ---------- */
export function normalizar(str){
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}