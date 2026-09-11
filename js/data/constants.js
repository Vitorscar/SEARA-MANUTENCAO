export const SUBCAUSAS = {
  "Elétrica":         ["Calorifício","Corpo estranho","Curto-circuito","Queima de componente","Falha de sensor"],
  "Mecânica":         ["Desalinhamento","Desgaste","Erro de montagem","Quebra","Folga excessiva"],
  "Civil/Estrutural": ["Rachadura","Infiltração","Corrosão estrutural","Fixação solta"],
  "Utilidades":       ["Oxidação","Sobrecarga","Falta de ar comprimido","Falha de energia"],
  "Projeto":          ["Subdimensionamento","Erro de especificação","Falha de projeto original"]
};

export const SETORES = [
  "Abate","Embalagem","Câmara fria","Expedição","Cortes","Utilidades","Caldeira",
  "Linha 01","Linha 02","Linha 03","Linha 04"
];

export const COMPONENTES_SUG = [
  "Correia","Rolamento","Fusível","Motor","Sensor","Redutor","Corrente","Engrenagem",
  "Válvula","Disjuntor","Contator","Inversor de frequência","Eixo","Mancal","Mangueira hidráulica"
];

export const IMPACTOS         = ["Baixo","Médio","Alto","Crítico"];
export const TURNOS           = ["1º Turno","2º Turno","3º Turno"];
export const ESPECIALIDADES   = ["Mecânica","Elétrica","Hidráulica","Automação","Refrigeração","Civil","Multifuncional"];
export const ROLES            = ["admin","tecnico","supervisor"];
export const STATUS_TECNICO   = { disponivel:'Disponível', atendendo:'Atendendo', offline:'Offline' };

export const COLUNAS = [
  { id:'fila',       nome:'A Fazer'      },
  { id:'andamento',  nome:'Em Andamento' },
  { id:'aguardando', nome:'Aguardando'   },
  { id:'concluido',  nome:'Concluído'    }
];