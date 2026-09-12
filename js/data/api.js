/* =========================================================
   api.js — Supabase real + fallback garantido (Offline-First)
   ========================================================= */

import { supabase } from './supabase-client.js';
import { seed } from './seed.js';

const CACHE_KEY = 'seara_cache_v2';

/* ---------- Cache Local ---------- */
function cacheGet() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { 
    return null; 
  }
}

function cacheSet(db) {
  try { 
    localStorage.setItem(CACHE_KEY, JSON.stringify(db)); 
  } catch (e) {
    console.warn('[api] Falha ao salvar no cache local:', e);
  }
}

/* =========================================================
   LOAD
   ========================================================= */
async function load() {
  const cached = cacheGet();
  const online = navigator.onLine;

  /* ---------- Tenta Supabase ---------- */
  if (online) {
    try {
      console.log('[api] consultando Supabase…');

      const [u, m, p, o, a] = await Promise.all([
        supabase.from('usuarios').select('*').eq('ativo', true),
        supabase.from('maquinas').select('*').is('deleted_at', null),
        supabase.from('v_paradas_detalhadas').select('*'),
        supabase.from('ordens_servico').select('*'),
        supabase.from('anexos').select('*')
      ]);

      if (u.error) console.warn('[api] usuarios:', u.error.message);
      if (m.error) console.warn('[api] maquinas:', m.error.message);
      if (p.error) console.warn('[api] paradas:', p.error.message);

      /* Se a tabela principal (máquinas) falhar, cai para o cache */
      if (m.error) throw new Error('maquinas: ' + m.error.message);

      // Cálculo seguro do próximo número de parada (evita colisão de IDs)
      const maxSeq = (p.data || []).reduce((max, x) => Math.max(max, x.numero || 0), 0);

      const cache = {
        tecnicos: (u.data || []).map(x => ({
          id: x.id, nome: x.nome, chapa: x.chapa,
          matricula: x.chapa, turno: x.turno,
          especialidade: x.especialidade, role: x.role, ativo: x.ativo
        })),
        maquinas: (m.data || []).map(x => ({
          id: x.id,
          nome: x.nome,
          setor: x.setor,
          area: x.area,
          prioridade: x.prioridade,
          status: x.status,
          qr: x.qr_code,
          ativo: x.ativo
        })),
        paradas: (p.data || []).map(x => ({
          id: x.id, numero: x.numero,
          maquinaId: x.maquina_id, maquinaNome: x.maquina,
          setor: x.setor, area: x.area,
          turno: x.turno, impacto: x.impacto, status: x.status,
          // CORREÇÃO: Proteção contra datas nulas que gerariam NaN
          horaInicio: x.hora_inicio ? new Date(x.hora_inicio).getTime() : Date.now(),
          horaAssumida: x.hora_assumida ? new Date(x.hora_assumida).getTime() : null,
          horaFim: x.hora_fim ? new Date(x.hora_fim).getTime() : null,
          duracaoMin: x.duracao_min,
          tecnicoId: x.tecnico_id,
          categoria: x.categoria, subcausa: x.subcausa,
          componente: x.componente, causaRaiz: x.causa_raiz,
          acaoComponente: x.acao_componente,
          acaoPreventiva: x.acao_preventiva, responsavel: x.responsavel, observacao: x.observacao,
          anexos: (a.data || []).filter(z => z.parada_id === x.id)
        })),
        os: (o.data || []).map(x => ({
          id: x.id, paradaId: x.parada_id, maquinaId: x.maquina_id,
          titulo: x.titulo, coluna: x.coluna, tecnicoId: x.tecnico_id
        })),
        equipamentosDescobertos: cached?.equipamentosDescobertos || {},
        seqParada: maxSeq + 1 // CORREÇÃO: Dinâmico, não mais fixo em 1
      };

      console.log(`[api] carregado: ${cache.maquinas.length} máquinas, ${cache.tecnicos.length} técnicos`);
      cacheSet(cache);
      return cache;

    } catch (err) {
      console.warn('[api] Supabase falhou, usando cache:', err.message);
    }
  }

  /* ---------- Fallback: cache local ---------- */
  if (cached) {
    console.info('[api] usando cache local (offline ou erro de rede)');
    return cached;
  }

  /* ---------- Fallback final: seed ---------- */
  console.info('[api] usando seed (banco vazio ou primeiro acesso)');
  const s = seed();
  cacheSet(s);
  return s;
}

/* =========================================================
   SAVE (Offline-First: salva no local, sync é tratado via RPCs)
   ========================================================= */
async function save(db) {
  cacheSet(db);
  return true;
}

/* =========================================================
   RPCs (Funções do Banco de Dados)
   ========================================================= */
async function cadastrarFuncionario({ nome, chapa, turno, especialidade, role }){
  const { data, error } = await supabase.rpc('cadastrar_funcionario', {
    p_nome:          nome,
    p_chapa:         chapa,
    p_turno:         turno,
    p_especialidade: especialidade || 'Multifuncional',
    p_role:          role || 'tecnico'
  });
  if(error) throw new Error(error.message);
  if(!data?.ok) throw new Error(data?.msg || 'Erro ao cadastrar');
  return data.funcionario;
}

async function validarLoginChapa(chapa) {
  const { data, error } = await supabase.rpc('login_chapa', { p_chapa: chapa });
  if (error) throw new Error(error.message);
  return data;
}

async function validarLoginAdmin(login, senha) {
  const { data, error } = await supabase.rpc('login_admin', {
    p_login: login, p_senha: senha
  });
  if (error) throw new Error(error.message);
  return data;
}

async function criarDirecionamento({ maquinaId, tecnicoIds, paradaId, prioridade, observacao, criadoPorNome }) {
  const { data, error } = await supabase.rpc('criar_direcionamento', {
    p_maquina_id: maquinaId,
    p_tecnico_ids: tecnicoIds,        // array de UUIDs/IDs
    p_parada_id: paradaId || null,
    p_prioridade: prioridade || 2,
    p_observacao: observacao || null,
    p_criado_por: null,               // Ajuste conforme sua regra de negócio no DB
    p_criado_nome: criadoPorNome || 'SGA'
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.msg || 'Erro ao direcionar');
  return data;
}

async function minhasNotificacoes(usuarioId) {
  const { data, error } = await supabase.rpc('minhas_notificacoes', { p_usuario_id: usuarioId });
  if (error) throw new Error(error.message);
  return data || [];
}

async function marcarNotifLida(notifId) {
  const { error } = await supabase.rpc('marcar_notificacao_lida', { p_notif_id: notifId });
  if (error) throw new Error(error.message);
}

async function aceitarDirecionamento(direcId, tecnicoId) {
  const { data, error } = await supabase.rpc('aceitar_direcionamento', {
    p_direc_id: direcId, p_tecnico_id: tecnicoId
  });
  if (error) throw new Error(error.message);
  return data;
}

/* =========================================================
   API EXPORTADA
   ========================================================= */
export const api = {
  // Core
  load,
  save,

  // Autenticação
  validarLoginChapa,
  validarLoginAdmin,

  // Equipe e Direcionamento
  cadastrarFuncionario,
  criarDirecionamento,
  aceitarDirecionamento,
  
  // Notificações
  minhasNotificacoes,
  marcarNotifLida,

  /* 
   * Stubs para operações que são tratadas 100% no estado local (offline-first).
   * O `equipe.service.js` e `registro.service.js` atualizam o `state.db` e chamam `api.save()`.
   * A sincronização com o Supabase deve ser feita via triggers no banco ou jobs em segundo plano.
   */
  async criarParada() { return null; },
  async atualizarParada() { return null; },
  async assumirParada() { return null; },
  async moverOS() { return null; },
  async uploadAnexo() { return null; }
};