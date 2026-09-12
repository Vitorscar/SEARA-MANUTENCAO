/* =========================================================
   turnos.js — definição oficial dos turnos da fábrica
   ⚠️ Ajuste os horários REAIS conforme a Seara opera
   ========================================================= */

export const TURNOS_CONFIG = {
  '1º Turno': {
    inicio: '06:00',
    fim:    '14:00',
    toleranciaMin: 15   // pode entrar 15min antes
  },
  '2º Turno': {
    inicio: '14:00',
    fim:    '22:00',
    toleranciaMin: 15
  },
  '3º Turno': {
    inicio: '22:00',
    fim:    '06:00',    // cruza meia-noite
    toleranciaMin: 15
  }
};

/* Regex da chapa: exatamente 9 dígitos */
export const CHAPA_REGEX = /^\d{9}$/;

/* Mensagens (fonte única) */
export const MSG = {
  CHAPA_INVALIDA:     'Número da chapa inválido. Informe uma chapa com 9 dígitos.',
  NAO_ENCONTRADO:     'Funcionário não encontrado. Verifique o número da chapa.',
  INATIVO:            'Funcionário inativo. Procure o RH.',
  FORA_TURNO:         'Acesso bloqueado. Você está fora do horário do seu turno.',
  SEM_TURNO:          'Funcionário sem turno cadastrado. Procure o supervisor.',
  AUTORIZADO:         'Acesso autorizado. Bem-vindo ao Sistema de Manutenção.'
};