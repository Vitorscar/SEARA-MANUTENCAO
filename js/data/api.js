/* =========================================================
   api.js — adapter Supabase + fallback offline
   Estrutura:
     api.load()           → carrega tudo
     api.save(db)         → salva no cache
     api.auth.*           → RPCs de login
     api.usuarios.*       → CRUD de funcionários
     api.maquinas.*       → CRUD de máquinas
     api.paradas.*        → CRUD de paradas
   ========================================================= */

import { supabase } from './supabase-client.js';
import { seed }     from './seed.js';

const CACHE_KEY = 'seara_cache_v2';

/* =========================================================
   CACHE LOCAL
   ========================================================= */
function cacheGet(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e){ return null; }
}
function cacheSet(db){
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(db));
  } catch(e){
    console.warn('[api] cache cheio:', e.message);
  }
}

/* =========================================================
   HELPERS — utilitários de data
   ========================================================= */
function paraISO(ts){
  if(!ts) return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  if(isNaN(d.getTime())) return null;
  return d.toISOString();
}

function paraMs(iso){
  if(!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/* =========================================================
   HELPERS — mapeamento linha → objeto
   ========================================================= */
function mapUsuario(u){
  if(!u) return null;
  return {
    id:            u.id,
    nome:          u.nome,
    chapa:         u.chapa,
    matricula:     u.chapa,
    turno:         u.turno,
    especialidade: u.especialidade,
    role:          u.role,
    ativo:         u.ativo
  };
}

function mapMaquina(m){
  if(!m) return null;
  return {
    id:         m.id,
    nome:       m.nome,
    setor:      m.setor || '',
    area:       m.area  || '',
    prioridade: m.prioridade,
    status:     m.status,
    qr:         m.qr_code || '',
    ativo:      m.ativo
  };
}

function mapParada(p, anexos = []){
  if(!p) return null;
  return {
    id:                  p.id,
    numero:              p.numero,

    /* Máquina / local */
    maquinaId:           p.maquina_id,
    maquinaNome:         p.maquina || null,
    setor:               p.setor || '',
    area:                p.area || '',

    /* Identificação */
    data:                p.data_ocorrencia || null,         // 🆕
    turno:               p.turno,
    impacto:             p.impacto,
    status:              p.status,

    /* Tempos */
    horaInicio:          paraMs(p.hora_inicio) || Date.now(),
    horaAssumida:        paraMs(p.hora_assumida),
    horaFim:             paraMs(p.hora_fim),
    duracaoMin:          p.duracao_min,

    /* Técnico */
    tecnicoId:           p.tecnico_id,
    responsavel:         p.responsavel || '',
    chapaTecnico:        p.chapa_tecnico || '',

    /* Falha */
    categoria:           p.categoria || '',
    causaRaizCategoria:  p.causa_raiz_categoria || '',       // 🆕
    componente:          p.componente || '',
    causaRaiz:           p.causa_raiz || '',                 // texto livre (detalhe)

    /* Ação */
    acaoComponente:      p.acao_componente || '',
    acaoPreventiva:      p.acao_preventiva || '',

    /* Extras */
    observacao:          p.observacao || '',
    anexos:              anexos.filter(a => a.parada_id === p.id)
  };
}

/* =========================================================
   LOAD
   ========================================================= */
async function load(){
  const cached = cacheGet();

  if(navigator.onLine){
    try {
      console.log('[api] consultando Supabase…');

      const [u, m, p, o, a] = await Promise.all([
        supabase.from('usuarios').select('*').eq('ativo', true),
        supabase.from('maquinas').select('*').is('deleted_at', null),
        supabase.from('v_paradas_detalhadas').select('*'),
        supabase.from('ordens_servico').select('*'),
        supabase.from('anexos').select('*')
      ]);

      if(u.error) console.warn('[api] usuarios:', u.error.message);
      if(m.error) console.warn('[api] maquinas:', m.error.message);
      if(p.error) console.warn('[api] paradas:', p.error.message);

      /* Bloqueia só se máquinas falhar (tabela principal) */
      if(m.error) throw new Error('maquinas: ' + m.error.message);

      const maxSeq = (p.data || []).reduce(
        (max, x) => Math.max(max, x.numero || 0), 0
      );

      const cache = {
        tecnicos: (u.data || []).map(mapUsuario),
        maquinas: (m.data || []).map(mapMaquina),
        paradas:  (p.data || []).map(x => mapParada(x, a.data || [])),
        os:       (o.data || []).map(x => ({
          id:        x.id,
          paradaId:  x.parada_id,
          maquinaId: x.maquina_id,
          titulo:    x.titulo,
          coluna:    x.coluna,
          tecnicoId: x.tecnico_id
        })),
        equipamentosDescobertos: cached?.equipamentosDescobertos || {},
        seqParada: maxSeq + 1,
        currentUser: cached?.currentUser || null,
        sessao:      cached?.sessao || null
      };

      console.log(
        `[api] carregado: ${cache.maquinas.length} máquinas, ${cache.tecnicos.length} técnicos`
      );
      cacheSet(cache);
      return cache;

    } catch(err){
      console.warn('[api] Supabase falhou:', err.message);
    }
  }

  if(cached){
    console.info('[api] usando cache local');
    return cached;
  }

  console.info('[api] usando seed (primeiro acesso)');
  const s = seed();
  cacheSet(s);
  return s;
}

async function save(db){
  cacheSet(db);
  return true;
}

/* =========================================================
   AUTH — RPCs
   ========================================================= */
async function loginChapa(chapa){
  const { data, error } = await supabase.rpc('login_chapa', { p_chapa: chapa });
  if(error) throw new Error(error.message);
  return data;
}

async function loginAdmin(login, senha){
  const { data, error } = await supabase.rpc('login_admin', {
    p_login: login, p_senha: senha
  });
  if(error) throw new Error(error.message);
  return data;
}

/* =========================================================
   USUÁRIOS
   ========================================================= */
const usuariosApi = {
  async listar(){
    const { data, error } = await supabase
      .from('usuarios').select('*').eq('ativo', true).order('nome');
    if(error) throw new Error(error.message);
    return (data || []).map(mapUsuario);
  },

  async buscarPorChapa(chapa){
    const { data, error } = await supabase
      .from('usuarios').select('*').eq('chapa', chapa).maybeSingle();
    if(error) throw new Error(error.message);
    return mapUsuario(data);
  },

  async cadastrar({ nome, chapa, turno, especialidade, role }){
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
};

/* =========================================================
   MÁQUINAS
   ========================================================= */
const maquinasApi = {
  async listar(){
    const { data, error } = await supabase
      .from('maquinas').select('*')
      .order('setor').order('nome');
    if(error) throw new Error(error.message);
    return (data || []).map(mapMaquina);
  },

  async criar({ nome, setor, area, qr, prioridade }){
    const { data, error } = await supabase
      .from('maquinas').insert({
        nome,
        setor,
        area:       area || null,
        qr_code:    qr || null,
        prioridade: prioridade || 2,
        status:     'operando',
        ativo:      true
      }).select().single();
    if(error) throw new Error(error.message);
    return mapMaquina(data);
  },

  async atualizar(id, patch){
    const linha = {};
    if(patch.nome)   linha.nome = patch.nome;
    if(patch.setor)  linha.setor = patch.setor;
    if(patch.area)   linha.area = patch.area;
    if(patch.status) linha.status = patch.status;

    const { data, error } = await supabase
      .from('maquinas').update(linha).eq('id', id).select().single();
    if(error) throw new Error(error.message);
    return mapMaquina(data);
  }
};

/* =========================================================
   PARADAS
   ========================================================= */
const paradasApi = {
  async listar({ status = null, limite = 200 } = {}){
    let q = supabase
      .from('paradas')
      .select('*, maquinas(nome)')
      .order('hora_inicio', { ascending: false })
      .limit(limite);

    if(status) q = q.eq('status', status);

    const { data, error } = await q;
    if(error) throw new Error(error.message);

    return (data || []).map(p => ({
      ...mapParada({ ...p, maquina: p.maquinas?.nome || '' }, [])
    }));
  },

  async buscar(id){
    const { data, error } = await supabase
      .from('paradas').select('*, maquinas(nome)')
      .eq('id', id).single();
    if(error) throw new Error(error.message);
    return {
      ...mapParada({ ...data, maquina: data.maquinas?.nome || '' }, [])
    };
  },

  /* =====================================================
     CRIAR NOVA PARADA
     ===================================================== */
  async criar(payload){
    const linha = {
      /* Máquina / local */
      maquina_id:          payload.maquinaId,
      setor:               payload.setor || null,
      area:                payload.area || null,

      /* Identificação */
      data_ocorrencia:     payload.data || new Date().toISOString().slice(0,10), // 🆕
      turno:               payload.turno,
      impacto:             payload.impacto || 'Alto',
      status:              payload.status || 'aguardando',

      /* Técnico */
      tecnico_id:          payload.tecnicoId || null,
      responsavel_nome:    payload.responsavel || null,
      chapa_tecnico:       payload.chapa || payload.chapaTecnico || null,

      /* Falha */
      categoria:           payload.categoria || null,
      causa_raiz_categoria: payload.causaRaiz || null,       // 🆕
      componente:          payload.componente || null,
      causa_raiz:          payload.causaRaizDetalhe || payload.componente || null,

      /* Ação */
      acao_componente:     payload.acaoComponente || null,
      acao_preventiva:     payload.acaoPreventiva || null,

      /* Extras */
      observacao:          payload.observacao || null,

      /* Tempo */
      hora_inicio:         new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('paradas').insert(linha).select().single();

    if(error) throw new Error(error.message);
    return mapParada(data);
  },

  /* =====================================================
     ENCERRAR PARADA EXISTENTE
     ===================================================== */
  async encerrar(id, patch = {}){
    const linha = {
      status:              'encerrada',
      hora_fim:            new Date().toISOString(),

      /* Permite corrigir os dados no fechamento */
      categoria:           patch.categoria,
      causa_raiz_categoria: patch.causaRaiz || null,         // 🆕
      componente:          patch.componente,
      causa_raiz:          patch.causaRaizDetalhe || patch.componente,
      acao_componente:     patch.acaoComponente,
      acao_preventiva:     patch.acaoPreventiva || null,     // 🆕
      observacao:          patch.observacao
    };

    /* Remove chaves undefined/null que não devem ser atualizadas */
    Object.keys(linha).forEach(k => {
      if(linha[k] === undefined) delete linha[k];
    });

    const { data, error } = await supabase
      .from('paradas').update(linha).eq('id', id).select().single();

    if(error) throw new Error(error.message);
    return mapParada(data);
  }
};

/* =========================================================
   EXPORT
   ========================================================= */
export const api = {
  /* core */
  load,
  save,

  /* sub-módulos */
  auth: {
    loginChapa,
    loginAdmin
  },
  usuarios: usuariosApi,
  maquinas: maquinasApi,
  paradas:  paradasApi,

  /* aliases de compatibilidade */
  validarLoginChapa: loginChapa,
  validarLoginAdmin: loginAdmin,
  cadastrarFuncionario: usuariosApi.cadastrar
};