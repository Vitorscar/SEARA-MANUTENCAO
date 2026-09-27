/* =========================================================
   paradas.service.js — criar / editar / encerrar parada
   Grava no Supabase + mantém o cache local sincronizado

   🆕 Encerramento agora recebe "tempoTotal" em texto livre
      (ex: "45min", "1h30", "2h") e converte pra duracao_min.
      Não usa mais hora_inicio/hora_fim pra calcular.
   ========================================================= */

import { state, salvarDB, getMaquina } from '../core/state.js';
import { api }                         from '../data/api.js';

/* =========================================================
   PARSE DE DURAÇÃO — texto livre → minutos
   Aceita: 45 | 45min | 45m | 1h | 1h30 | 1h30min | 2:30 | 1,5h
   ========================================================= */
export function parseDuracao(texto){
  if(!texto) return 0;

  const s = String(texto)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');

  /* 1h30 | 1h30min | 1h */
  let m = s.match(/^(\d+(?:\.\d+)?)h(?:(\d+(?:\.\d+)?)m(?:in)?)?$/);
  if(m){
    const h = parseFloat(m[1]) || 0;
    const min = parseFloat(m[2]) || 0;
    return Math.round(h * 60 + min);
  }

  /* 1:30 | 01:30 */
  m = s.match(/^(\d+):(\d{1,2})$/);
  if(m){
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  /* 45min | 45m */
  m = s.match(/^(\d+(?:\.\d+)?)(?:min|m)$/);
  if(m){
    return Math.round(parseFloat(m[1]));
  }

  /* 45 (só número = minutos) */
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if(m){
    return Math.round(parseFloat(m[1]));
  }

  return 0;
}

/* =========================================================
   CRIAR PARADA
   ========================================================= */
export async function criarParada(payload){
  const chapa      = String(payload.chapa || '').replace(/\D/g, '');
  const maquinaId  = payload.maquinaId;
  const setor      = String(payload.setor || '').trim();
  const categoria  = payload.categoria;
  const causaRaiz  = payload.causaRaiz;
  const componente = payload.componente;
  const acaoComp   = payload.acaoComponente;

  if(chapa.length !== 10) throw new Error('Chapa deve ter 10 dígitos.');
  if(!maquinaId)          throw new Error('Máquina não informada.');
  if(!setor)              throw new Error('Setor não informado.');
  if(!categoria)          throw new Error('Tipo de falha não informado.');
  if(!causaRaiz)          throw new Error('Causa raiz não informada.');
  if(!componente)         throw new Error('Componente não informado.');
  if(!acaoComp)           throw new Error('Ação no componente não informada.');

  const maq = getMaquina(maquinaId);
  if(!maq) throw new Error('Máquina não encontrada.');

  if(maq.setor && maq.setor !== setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${setor}". ` +
      `Ela está cadastrada em "${maq.setor}".`
    );
  }

  const user = state.db?.currentUser;
  let tecnicoId       = user?.id || null;
  let responsavelNome = payload.responsavel || user?.nome || null;

  if(chapa !== user?.chapa){
    const outro = (state.db.tecnicos || []).find(t => t.chapa === chapa);
    if(outro){
      tecnicoId       = outro.id;
      responsavelNome = responsavelNome || outro.nome;
    } else {
      tecnicoId = null;
    }
  }

  const dados = {
    maquinaId,
    setor,
    area:           payload.area || maq.area || null,
    turno:          payload.turno,
    impacto:        payload.impacto || 'Alto',
    status:         'aguardando',

    tecnicoId,
    responsavel:    responsavelNome,
    chapaTecnico:   chapa,

    categoria,
    causaRaiz,
    componente,

    acaoComponente: acaoComp,
    acaoPreventiva: payload.acaoPreventiva || 'Nenhuma',

    observacao:     payload.observacao || null
  };

  const parada = await api.paradas.criar(dados);

  state.db.paradas = state.db.paradas || [];
  state.db.paradas.unshift({
    ...parada,
    maquinaId,
    maquinaNome: maq.nome,
    setor,
    area: payload.area || maq.area || ''
  });

  maq.status = 'parada';
  try {
    await api.maquinas.atualizar(maquinaId, { status: 'parada' });
  } catch(err){
    console.warn('[paradas] status da máquina não sincronizou:', err.message);
  }

  salvarDB();
  return parada;
}

/* =========================================================
   EDITAR / ENCERRAR PARADA
   opts.encerrar = true → exige payload.tempoTotal (texto livre),
                          parseia e salva em duracao_min.
                          NÃO envia mais hora_fim.
   ========================================================= */
export async function atualizarParada(id, payload, opts = {}){
  if(!id) throw new Error('ID da parada não informado.');

  const local = (state.db.paradas || []).find(p => p.id === id);

  const maqId = payload.maquinaId || local?.maquinaId;
  const maq   = maqId ? getMaquina(maqId) : null;

  if(payload.setor && maq?.setor && maq.setor !== payload.setor){
    throw new Error(
      `Máquina "${maq.nome}" não pertence ao setor "${payload.setor}".`
    );
  }

  const patch = {
    categoria:      payload.categoria      || null,
    causaRaiz:      payload.causaRaiz      || null,
    componente:     payload.componente     || null,
    acaoComponente: payload.acaoComponente || null,
    acaoPreventiva: payload.acaoPreventiva || null,
    observacao:     payload.observacao     || null
  };

  if(payload.setor) patch.setor = payload.setor;
  if(payload.area)  patch.area  = payload.area;

  /* 🆕 Encerramento: parseia tempo total e envia duracao_min */
  if(opts.encerrar){
    const txt = String(payload.tempoTotal || '').trim();
    if(!txt){
      throw new Error('Informe o tempo total (ex: 45min, 1h30, 2h).');
    }

    const duracao = parseDuracao(txt);
    if(duracao <= 0){
      throw new Error(
        'Tempo total inválido. Use formatos como: 45min, 1h30, 2h, 90.'
      );
    }

    patch.duracaoMin = duracao;
    /* ⚠️ NÃO envia hora_fim — coluna removida do banco */
  }

  let paradaAtualizada;
  if(opts.encerrar){
    paradaAtualizada = await api.paradas.encerrar(id, patch);
  } else {
    paradaAtualizada = await api.paradas.atualizar(id, patch);
  }

  if(local){
    Object.assign(local, paradaAtualizada || {}, patch);
  }

  /* Libera a máquina se encerrou */
  if(opts.encerrar && maqId){
    const m = (state.db.maquinas || []).find(x => x.id === maqId);
    if(m) m.status = 'operando';

    try {
      await api.maquinas.atualizar(maqId, { status: 'operando' });
    } catch(err){
      console.warn('[paradas] máquina não foi liberada:', err.message);
    }
  }

  salvarDB();
  return paradaAtualizada;
}

/* =========================================================
   HELPERS
   ========================================================= */
export function getParadaAberta(){
  return (state.db.paradas || []).find(p => p.status !== 'encerrada') || null;
}

export function totalParadasAbertas(){
  return (state.db.paradas || []).filter(p => p.status !== 'encerrada').length;
}

export function getParada(id){
  return (state.db.paradas || []).find(p => p.id === id) || null;
}

export function getParadasAbertasDaMaquina(maquinaId){
  return (state.db.paradas || []).filter(
    p => p.maquinaId === maquinaId && p.status !== 'encerrada'
  );
}
