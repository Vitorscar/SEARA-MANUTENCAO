/* =========================================================
   estrutura-plantas.js — árvore operacional da planta
   Formato: SETOR → ÁREA → EQUIPAMENTO → VARIANTES[]
   A chave "_" significa "setor sem área intermediária".
   "_livre: true" = setor dinâmico (aprendido pelos registros).
   ========================================================= */

export const ESTRUTURA = {

  /* ---------------------------------------------------------
     UTILIDADES
     --------------------------------------------------------- */
  "Utilidades": {
    "_": {
      "FFO": [],
      "Caldeira": [],
      "Sala de Máquinas": [],
      "Ar Comprimido": [],
      "Torres de Resfriamento": []
    }
  },

  /* ---------------------------------------------------------
     AVES
     --------------------------------------------------------- */
  "Aves": {
    "Pendura": {
      "Desempilhador": ["Linha 1", "Linha 2"],
      "Outros": [
        "Descarregamento", "Pendura", "Lavagem de Caixas",
        "Empilhador", "Sangria", "Escaldagem", "Transferidor"
      ]
    },
    "Viceração": {
      "Miúdos": [],
      "Chiller": ["Linha 1", "Linha 2"]
    },
    "Sala de Corte": {
      "Foodmate":         ["Linha 1", "Linha 2", "Linha 3", "Linha 4"],
      "Linha de Cone":    ["Linha 1", "Linha 2"],
      "Balança Aérea":    ["Linha 1", "Linha 2"],
      "Meyn / Filetadora":["Linha 1", "Linha 2"],
      "Linha BL":         ["Linha 1", "Linha 2"],
      "Raio-X":           ["Linha BL 1", "Linha BL 2"],
      "CMS": [
        "High-Tech 1", "High-Tech 2", "High-Tech 3",
        "Votator 1", "Votator 2", "Baader Linha 1",
        "Invasoras RC 1", "Invasoras RC 2", "Invasoras RC 3", "Invasoras RC 4"
      ]
    },
    "Sala de Corte / IQF": {
      "Ishida":      ["1", "2", "3"],
      "Pacmac":      ["1", "2", "3"],
      "Girofreezer": ["1", "2"]
    }
  },

  /* ---------------------------------------------------------
     PALETIZAÇÃO
     --------------------------------------------------------- */
  "Paletização": {
    "_": {
      "Esteira Aérea Sorter":    [],
      "Túnel TRV":               [],
      "Túnel TCA":               [],
      "Esteira Inferior Sorter": [],
      "Seladora":                ["Seladora 1", "Seladora 2", "Seladora 3", "Seladora IQF"],
      "Túnel de Estocagem":      []
    }
  },

  /* ---------------------------------------------------------
     LOGÍSTICA
     --------------------------------------------------------- */
  "Logística": {
    "_": {
      "Túnel de Congelamento": [],
      "Estreichadora 1":       [],
      "Estreichadora 2":       []
    }
  },

  /* ---------------------------------------------------------
     INDUSTRIALIZADOR — setor dinâmico (aprendido)
     --------------------------------------------------------- */
  "Industrializador": {
    "_livre": true
  }
};