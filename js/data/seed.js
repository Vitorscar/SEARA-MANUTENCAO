/* =========================================================
   seed.js — estrutura inicial (SEM funcionários fake)
   O SGA cadastra tudo pela tela Equipe.
   ========================================================= */

export function seed(){
  const now = Date.now();
  return {
    /* ---------------------------------------------
       Sem técnicos pré-cadastrados.
       Só o SGA (que está fixo no auth.service.js) entra.
       --------------------------------------------- */
    tecnicos: [],

    maquinas: [],

    paradas: [],

    os: [],

    equipamentosDescobertos: {},

    seqParada: 1
  };
}