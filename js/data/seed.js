export function seed(){
  const now = Date.now();
  return {
    currentUser: { id:'u1', nome:'Carlos Andrade', role:'admin', especialidade:'Automação' },
    maquinas: [
      {id:'m1', nome:'Prensa 02',     setor:'Linha 03',  prioridade:1, status:'parada',   qr:'MQ-PRENSA-02'},
      {id:'m2', nome:'Esteira 04',    setor:'Linha 01',  prioridade:2, status:'parada',   qr:'MQ-ESTEIRA-04'},
      {id:'m3', nome:'Injetora 07',   setor:'Linha 02',  prioridade:1, status:'operando', qr:'MQ-INJETORA-07'},
      {id:'m4', nome:'Torno CNC 11',  setor:'Linha 04',  prioridade:2, status:'operando', qr:'MQ-TORNO-11'},
      {id:'m5', nome:'Compressor 01', setor:'Utilidades',prioridade:1, status:'operando', qr:'MQ-COMP-01'},
      {id:'m6', nome:'Seladora 09',   setor:'Linha 02',  prioridade:3, status:'operando', qr:'MQ-SEL-09'}
    ],
    tecnicos: [
      {id:'t1', nome:'João Silva',  especialidade:'Mecânica',  matricula:'T001', role:'tecnico',    turno:'1º Turno', ativo:true},
      {id:'t2', nome:'Carla Souza', especialidade:'Elétrica',  matricula:'T002', role:'tecnico',    turno:'1º Turno', ativo:true},
      {id:'t3', nome:'Marcos Lima', especialidade:'Mecânica',  matricula:'T003', role:'supervisor', turno:'2º Turno', ativo:true},
      {id:'t4', nome:'Ana Prado',   especialidade:'Automação', matricula:'T004', role:'tecnico',    turno:'1º Turno', ativo:true}
    ],
    paradas: [
      {id:'p1', numero:1, maquinaId:'m1', setor:'Linha 03', turno:'1º Turno',
       horaInicio: now - 48*60000, horaFim:null, duracaoMin:null,
       impacto:'Crítico', status:'aguardando', tecnicoId:null,
       categoria:null, subcausa:null, componente:null, causaRaiz:'Vazamento hidráulico',
       acaoComponente:null, acaoPreventiva:null, responsavel:null, observacao:null, foto:null},
      {id:'p2', numero:2, maquinaId:'m2', setor:'Linha 01', turno:'1º Turno',
       horaInicio: now - 18*60000, horaFim:null, duracaoMin:null,
       impacto:'Médio', status:'atendendo', tecnicoId:'t1',
       categoria:'Elétrica', subcausa:'Falha de sensor', componente:'Sensor de posição',
       causaRaiz:'Sensor de posição com falha',
       acaoComponente:null, acaoPreventiva:null, responsavel:null, observacao:null, foto:null}
    ],
    os: [
      {id:'os1', paradaId:'p1', maquinaId:'m1', titulo:'Vazamento hidráulico', coluna:'fila',      tecnicoId:null},
      {id:'os2', paradaId:'p2', maquinaId:'m2', titulo:'Sensor de posição',   coluna:'andamento', tecnicoId:'t1'}
    ],
    seqParada: 3
  };
}