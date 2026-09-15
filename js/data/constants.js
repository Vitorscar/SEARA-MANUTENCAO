/* =========================================================
   constants.js — listas mestras do sistema
   ========================================================= */

/* ---------- TIPO DE FALHA (categorias) ---------- */
export const TIPOS_FALHA = [
  "Civil/Estrutural",
  "Elétrica",
  "Eletrônica",
  "Mecânica",
  "Projeto",
  "Utilidade"
];

/* ---------- CAUSA RAIZ (lista única) ---------- */
export const CAUSAS_RAIZ = [
  "Calor/Frio",
  "Corpo Estranho",
  "Desalinhamento",
  "Desgaste",
  "Erro de Montagem",
  "Falha de Calibração",
  "Falha de Componente",
  "Falha de Manutenção",
  "Fatores Externos",
  "Folga",
  "Lubrificação",
  "Mau Uso",
  "Oxidação",
  "Partidas Excessivas",
  "Produto Fora do Padrão",
  "Sobrecarga",
  "Sujidade",
  "Umidade"
];

/* ---------- AÇÃO NO COMPONENTE ---------- */
export const ACOES_COMPONENTE = [
  "Adaptado",
  "Conserto",
  "Substituído por item do estoque"
];

/* ---------- AÇÃO PREVENTIVA ---------- */
export const ACOES_PREVENTIVAS = [
  "Substituído por item reserva",
  "Nenhuma"
];

/* ---------- SETORES ---------- */
export const SETORES = [
  "Abate", "Embalagem", "Câmara fria", "Expedição", "Cortes",
  "Utilidades", "Caldeira",
  "Linha 01", "Linha 02", "Linha 03", "Linha 04"
];

/* ---------- COMPONENTES (sugestões) ---------- */
export const COMPONENTES_SUG = [
  "Correia", "Rolamento", "Fusível", "Motor", "Sensor",
  "Redutor", "Corrente", "Engrenagem", "Válvula", "Disjuntor",
  "Contator", "Inversor de frequência", "Eixo", "Mancal",
  "Mangueira hidráulica", "Cabo", "Bornes"
];

/* ---------- IMPACTO ---------- */
export const IMPACTOS = ["Baixo", "Médio", "Alto", "Crítico"];

/* ---------- TURNOS ---------- */
export const TURNOS = ["1º Turno", "2º Turno", "3º Turno"];

/* ---------- ESPECIALIDADES ---------- */
export const ESPECIALIDADES = [
  "Mecânica", "Elétrica", "Hidráulica", "Automação",
  "Refrigeração", "Civil", "Multifuncional"
];

/* ---------- PERFIS ---------- */
export const ROLES = ["admin", "tecnico", "supervisor"];

/* ---------- STATUS DO TÉCNICO ---------- */
export const STATUS_TECNICO = {
  disponivel: 'Disponível',
  atendendo:  'Atendendo',
  offline:    'Offline'
};

/* ---------- COLUNAS DO KANBAN ---------- */
export const COLUNAS = [
  { id:'fila',       nome:'A Fazer'      },
  { id:'andamento',  nome:'Em Andamento' },
  { id:'aguardando', nome:'Aguardando'   },
  { id:'concluido',  nome:'Concluído'    }
];