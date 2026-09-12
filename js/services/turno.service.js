/* =========================================================
   turno.service.js — validação de horário de turno
   Hoje roda no cliente. Amanhã chama RPC do Supabase:
     supabase.rpc('validar_turno', { chapa })
   ========================================================= */

import { TURNOS_CONFIG, MSG } from '../data/turnos.js';

/* Converte "HH:MM" → minutos desde 00:00 */
function hhmmParaMin(hhmm){
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/* =========================================================
   Verifica se um horário está dentro de um turno
   Suporta turnos que cruzam a meia-noite (ex: 22:00 → 06:00)
   ========================================================= */
export function dentroDoTurno(turno, data = new Date()){
  const cfg = TURNOS_CONFIG[turno];
  if(!cfg) return { ok:false, motivo:'sem-turno', msg: MSG.SEM_TURNO };

  const agora   = data.getHours() * 60 + data.getMinutes();
  const inicio  = hhmmParaMin(cfg.inicio);
  const fim     = hhmmParaMin(cfg.fim);
  const tol     = cfg.toleranciaMin || 0;

  let dentro = false;

  if(inicio <= fim){
    /* Turno normal: 06:00 → 14:00 */
    dentro = agora >= (inicio - tol) && agora <= (fim + tol);
  } else {
    /* Turno que cruza meia-noite: 22:00 → 06:00 */
    dentro = agora >= (inicio - tol) || agora <= (fim + tol);
  }

  return {
    ok: dentro,
    motivo: dentro ? 'ok' : 'fora-turno',
    msg: dentro ? MSG.AUTORIZADO : MSG.FORA_TURNO,
    turno,
    agora,
    inicio,
    fim,
    janela: `${cfg.inicio} – ${cfg.fim}`
  };
}

/* =========================================================
   Hora "do servidor"
   Hoje devolve a hora local. Amanhã substitui por:
     const { data } = await supabase.rpc('hora_servidor')
   ========================================================= */
export function horaServidor(){
  /* ⚠️ Em produção: nunca confie no relógio do dispositivo.
     Ver sql/rpc_validar_chapa.sql para a versão backend. */
  return new Date();
}

/* =========================================================
   Próximo início de turno (para mostrar "volte às 14h")
   ========================================================= */
export function proximaJanela(turno){
  const cfg = TURNOS_CONFIG[turno];
  if(!cfg) return null;

  const hoje = new Date();
  const agora = hoje.getHours() * 60 + hoje.getMinutes();
  const inicioMin = hhmmParaMin(cfg.inicio);

  const proximo = new Date(hoje);
  proximo.setSeconds(0,0);

  if(agora >= inicioMin){
    proximo.setDate(proximo.getDate() + 1);
  }
  const [h, m] = cfg.inicio.split(':').map(Number);
  proximo.setHours(h, m, 0, 0);
  return proximo;
}
/* =========================================================
   ESTADO DO TURNO DO FUNCIONÁRIO (para a tela Equipe)
   Retorna: 'ativo' | 'encerrado' | 'nao_iniciado' | 'sem_turno'
   ========================================================= */
export function estadoTurnoFuncionario(turno, data = new Date()){
  if(!turno) return 'sem_turno';

  const cfg = TURNOS_CONFIG[turno];
  if(!cfg) return 'sem_turno';

  const agora  = data.getHours() * 60 + data.getMinutes();
  const inicio = hhmmParaMin(cfg.inicio);
  const fim    = hhmmParaMin(cfg.fim);
  const tol    = cfg.toleranciaMin || 0;

  const iniComTol = (inicio - tol + 1440) % 1440;
  const fimComTol = (fim + tol) % 1440;

  if(inicio <= fim){
    /* Turno normal (06:00 → 14:00) */
    if(agora < iniComTol) return 'nao_iniciado';
    if(agora > fimComTol) return 'encerrado';
    return 'ativo';
  } else {
    /* Turno que cruza meia-noite (22:00 → 06:00) */
    const dentro =
      (agora >= iniComTol) || (agora <= fimComTol);
    if(dentro) return 'ativo';
    /* Se está entre fim e inicio (ex: 08h para 3º turno), o turno terminou */
    if(agora > fimComTol && agora < iniComTol) return 'encerrado';
    return 'nao_iniciado';
  }
}

/* ---------- helper: só quem pode ser direcionado ---------- */
export function podeSerDirecionado(turno){
  return estadoTurnoFuncionario(turno) === 'ativo';
}