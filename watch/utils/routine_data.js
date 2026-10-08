/**
 * VigorexiApp Watch - Base de datos de rutina y ejercicios
 * Optimizada para Zepp OS en Amazfit Active 2 (Round 466x466)
 */

export const ROUTINE_SLOTS = {
  // === PROGRAMA 1: FULL BODY CÍCLICO ROTATIVO (3 DÍAS) ===
  fullbodyA: {
    id: "fullbodyA",
    title: "Día A: Full Body A",
    subtitle: "Squat Pesado & Torso",
    dayNum: "Día A",
    shortName: "Día A (Squat + Torso)",
    program: "fullbody",
    totalSets: 20,
    slots: [
      { slotId: "fullbodyA_1", defaultExId: "squat", num: 1, sets: [["100", "8"], ["100", "8"], ["100", "7"]] },
      { slotId: "fullbodyA_2", defaultExId: "banca", num: 2, sets: [["80", "8"], ["80", "8"], ["80", "7"], ["80", "6"]] },
      { slotId: "fullbodyA_3", defaultExId: "jalon", num: 3, sets: [["70", "10"], ["70", "10"], ["70", "9"], ["70", "8"]] },
      { slotId: "fullbodyA_4", defaultExId: "laterales1", num: 4, sets: [["12", "15"], ["12", "14"], ["12", "12"]] },
      { slotId: "fullbodyA_5", defaultExId: "triceps1", num: 5, sets: [["30", "12"], ["30", "11"], ["30", "10"]] },
      { slotId: "fullbodyA_6", defaultExId: "biceps1", num: 6, sets: [["16", "12"], ["16", "10"], ["16", "10"]] }
    ]
  },
  fullbodyB: {
    id: "fullbodyB",
    title: "Día B: Full Body B",
    subtitle: "RDL & Torso Hipertrofia",
    dayNum: "Día B",
    shortName: "Día B (RDL + Torso)",
    program: "fullbody",
    totalSets: 20,
    slots: [
      { slotId: "fullbodyB_1", defaultExId: "rdl", num: 1, sets: [["90", "10"], ["90", "10"], ["90", "8"]] },
      { slotId: "fullbodyB_2", defaultExId: "inclinado", num: 2, sets: [["30", "10"], ["30", "10"], ["30", "8"], ["30", "8"]] },
      { slotId: "fullbodyB_3", defaultExId: "remouni", num: 3, sets: [["34", "10"], ["34", "10"], ["34", "9"], ["34", "8"]] },
      { slotId: "fullbodyB_4", defaultExId: "militar", num: 4, sets: [["24", "10"], ["24", "10"], ["24", "8"]] },
      { slotId: "fullbodyB_5", defaultExId: "facepull", num: 5, sets: [["25", "15"], ["25", "14"], ["25", "12"]] },
      { slotId: "fullbodyB_6", defaultExId: "plancha", num: 6, sets: [["0", "60"], ["0", "50"], ["0", "45"]] }
    ]
  },
  fullbodyC: {
    id: "fullbodyC",
    title: "Día C: Full Body C",
    subtitle: "Pierna & Brazos/Core",
    dayNum: "Día C",
    shortName: "Día C (Pierna + Hipertrofia)",
    program: "fullbody",
    totalSets: 22,
    slots: [
      { slotId: "fullbodyC_1", defaultExId: "prensa_45", num: 1, sets: [["140", "10"], ["140", "10"], ["140", "8"]] },
      { slotId: "fullbodyC_2", defaultExId: "curltumbado", num: 2, sets: [["50", "12"], ["50", "11"], ["50", "10"]] },
      { slotId: "fullbodyC_3", defaultExId: "jalonneutro", num: 3, sets: [["70", "10"], ["70", "10"], ["70", "9"], ["70", "8"]] },
      { slotId: "fullbodyC_4", defaultExId: "laterales2", num: 4, sets: [["10", "15"], ["10", "14"], ["10", "12"]] },
      { slotId: "fullbodyC_5", defaultExId: "frances", num: 5, sets: [["32", "12"], ["32", "10"], ["32", "10"]] },
      { slotId: "fullbodyC_6", defaultExId: "martillo", num: 6, sets: [["16", "12"], ["16", "11"], ["16", "10"]] },
      { slotId: "fullbodyC_7", defaultExId: "crunch", num: 7, sets: [["40", "15"], ["40", "14"], ["40", "12"]] }
    ]
  },

  // === PROGRAMA 2: TORSO / PIERNA (4 DÍAS) ===
  torsoA: {
    id: "torsoA",
    title: "Día 1: Torso A",
    subtitle: "Fuerza & Empuje",
    dayNum: "Día 1",
    shortName: "Torso A (Empuje)",
    totalSets: 23,
    slots: [
      { slotId: "torsoA_1", defaultExId: "banca", num: 1, sets: [["80", "8"], ["80", "8"], ["80", "7"], ["80", "6"]] },
      { slotId: "torsoA_2", defaultExId: "jalon", num: 2, sets: [["70", "10"], ["70", "10"], ["70", "9"], ["70", "8"]] },
      { slotId: "torsoA_3", defaultExId: "militar", num: 3, sets: [["24", "10"], ["24", "10"], ["24", "8"]] },
      { slotId: "torsoA_4", defaultExId: "remo", num: 4, sets: [["65", "10"], ["65", "10"], ["65", "9"]] },
      { slotId: "torsoA_5", defaultExId: "laterales1", num: 5, sets: [["12", "15"], ["12", "14"], ["12", "12"]] },
      { slotId: "torsoA_6", defaultExId: "triceps1", num: 6, sets: [["30", "12"], ["30", "11"], ["30", "10"]] },
      { slotId: "torsoA_7", defaultExId: "biceps1", num: 7, sets: [["16", "12"], ["16", "10"], ["16", "10"]] }
    ]
  },
  piernaA: {
    id: "piernaA",
    title: "Día 2: Pierna A",
    subtitle: "Sentadilla & Cuádriceps",
    dayNum: "Día 2",
    shortName: "Pierna A (Cuádriceps)",
    totalSets: 15,
    slots: [
      { slotId: "piernaA_1", defaultExId: "squat", num: 1, sets: [["100", "8"], ["100", "8"], ["100", "7"]] },
      { slotId: "piernaA_2", defaultExId: "legext", num: 2, sets: [["60", "12"], ["60", "11"], ["60", "10"]] },
      { slotId: "piernaA_3", defaultExId: "curltumbado", num: 3, sets: [["45", "12"], ["45", "11"], ["45", "10"]] },
      { slotId: "piernaA_4", defaultExId: "gemelopie", num: 4, sets: [["70", "12"], ["70", "12"], ["70", "10"]] },
      { slotId: "piernaA_5", defaultExId: "plancha", num: 5, sets: [["0", "60"], ["0", "50"], ["0", "45"]] }
    ]
  },
  torsoB: {
    id: "torsoB",
    title: "Día 3: Torso B",
    subtitle: "Tracción & Hipertrofia",
    dayNum: "Día 3",
    shortName: "Torso B (Tracción)",
    totalSets: 24,
    slots: [
      { slotId: "torsoB_1", defaultExId: "remouni", num: 1, sets: [["34", "10"], ["34", "10"], ["34", "9"], ["34", "8"]] },
      { slotId: "torsoB_2", defaultExId: "inclinado", num: 2, sets: [["30", "10"], ["30", "10"], ["30", "8"], ["30", "8"]] },
      { slotId: "torsoB_3", defaultExId: "jalonneutro", num: 3, sets: [["70", "10"], ["70", "10"], ["70", "9"], ["70", "8"]] },
      { slotId: "torsoB_4", defaultExId: "laterales2", num: 4, sets: [["10", "15"], ["10", "14"], ["10", "12"]] },
      { slotId: "torsoB_5", defaultExId: "facepull", num: 5, sets: [["25", "15"], ["25", "14"], ["25", "12"]] },
      { slotId: "torsoB_6", defaultExId: "frances", num: 6, sets: [["32", "12"], ["32", "10"], ["32", "10"]] },
      { slotId: "torsoB_7", defaultExId: "martillo", num: 7, sets: [["16", "12"], ["16", "11"], ["16", "10"]] }
    ]
  },
  piernaB: {
    id: "piernaB",
    title: "Día 4: Pierna B",
    subtitle: "Cadena Posterior & Búlgaras",
    dayNum: "Día 4",
    shortName: "Pierna B (Isquios)",
    totalSets: 18,
    slots: [
      { slotId: "piernaB_1", defaultExId: "rdl", num: 1, sets: [["90", "10"], ["90", "10"], ["90", "8"]] },
      { slotId: "piernaB_2", defaultExId: "bulgarian", num: 2, sets: [["20", "10"], ["20", "10"], ["20", "8"]] },
      { slotId: "piernaB_3", defaultExId: "curlsentado", num: 3, sets: [["55", "12"], ["55", "11"], ["55", "10"]] },
      { slotId: "piernaB_4", defaultExId: "legextb", num: 4, sets: [["55", "15"], ["55", "14"], ["55", "12"]] },
      { slotId: "piernaB_5", defaultExId: "gemelosentado", num: 5, sets: [["45", "15"], ["45", "14"], ["45", "12"]] },
      { slotId: "piernaB_6", defaultExId: "crunch", num: 6, sets: [["40", "15"], ["40", "14"], ["40", "12"]] }
    ]
  }
};

export const EXERCISE_CATALOG = {
  // --- TORSO A ---
  banca: {
    id: "banca",
    name: "Press Banca Plano",
    muscle: "Pectoral Mayor",
    rest: 150,
    stepKg: 2.5,
    alternatives: ["press_manc_plano", "press_maq_convergente", "press_multipower_plano"]
  },
  press_manc_plano: {
    id: "press_manc_plano",
    name: "Press Plano Mancuernas",
    muscle: "Pectoral Mayor",
    rest: 120,
    stepKg: 2.0,
    alternatives: ["banca", "press_maq_convergente", "press_multipower_plano"]
  },
  press_maq_convergente: {
    id: "press_maq_convergente",
    name: "Press Máq. Convergente",
    muscle: "Pectoral Mayor",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["banca", "press_manc_plano", "press_multipower_plano"]
  },
  press_multipower_plano: {
    id: "press_multipower_plano",
    name: "Press Multipower Plano",
    muscle: "Pectoral Mayor",
    rest: 120,
    stepKg: 2.5,
    alternatives: ["banca", "press_manc_plano", "press_maq_convergente"]
  },
  jalon: {
    id: "jalon",
    name: "Jalón al Pecho",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["dominadas_libres", "jalon_unilateral_polea", "jalon_neutro_cerrado"]
  },
  dominadas_libres: {
    id: "dominadas_libres",
    name: "Dominadas",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 2.5,
    metricType: "peso_corporal",
    alternatives: ["jalon", "jalon_unilateral_polea", "jalon_neutro_cerrado"]
  },
  jalon_unilateral_polea: {
    id: "jalon_unilateral_polea",
    name: "Jalón Unilateral Polea",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 2.5,
    metricType: "unilateral",
    alternatives: ["jalon", "dominadas_libres", "jalon_neutro_cerrado"]
  },
  jalon_neutro_cerrado: {
    id: "jalon_neutro_cerrado",
    name: "Jalón Agarre Neutro",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["jalon", "dominadas_libres", "jalon_unilateral_polea"]
  },
  militar: {
    id: "militar",
    name: "Press Militar Manc.",
    muscle: "Deltoides Anterior",
    rest: 120,
    stepKg: 2.0,
    alternatives: ["press_hombro_maquina", "press_militar_barra", "press_multipower_hombro"]
  },
  press_hombro_maquina: {
    id: "press_hombro_maquina",
    name: "Press Hombro Máquina",
    muscle: "Deltoides Anterior",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["militar", "press_militar_barra", "press_multipower_hombro"]
  },
  press_militar_barra: {
    id: "press_militar_barra",
    name: "Press Militar Barra",
    muscle: "Deltoides Anterior",
    rest: 150,
    stepKg: 2.5,
    alternatives: ["militar", "press_hombro_maquina", "press_multipower_hombro"]
  },
  press_multipower_hombro: {
    id: "press_multipower_hombro",
    name: "Press Hombro Multipower",
    muscle: "Deltoides Anterior",
    rest: 120,
    stepKg: 2.5,
    alternatives: ["militar", "press_hombro_maquina", "press_militar_barra"]
  },
  remo: {
    id: "remo",
    name: "Remo Polea Baja",
    muscle: "Espalda Media & Dorsal",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["remo_pecho_apoyado", "remo_mancuerna_banco", "remo_barra_t"]
  },
  remo_pecho_apoyado: {
    id: "remo_pecho_apoyado",
    name: "Remo Pecho Apoyado",
    muscle: "Espalda Media",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["remo", "remo_mancuerna_banco", "remo_barra_t"]
  },
  remo_mancuerna_banco: {
    id: "remo_mancuerna_banco",
    name: "Remo Mancuerna Banco",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["remo", "remo_pecho_apoyado", "remo_barra_t"]
  },
  remo_barra_t: {
    id: "remo_barra_t",
    name: "Remo en Barra T",
    muscle: "Espalda Media",
    rest: 120,
    stepKg: 2.5,
    alternatives: ["remo", "remo_pecho_apoyado", "remo_mancuerna_banco"]
  },
  laterales1: {
    id: "laterales1",
    name: "Elev. Laterales Manc.",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.0,
    alternatives: ["laterales_polea_baja", "laterales_maquina", "laterales_inclinado"]
  },
  laterales_polea_baja: {
    id: "laterales_polea_baja",
    name: "Elev. Laterales Polea",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.25,
    metricType: "unilateral",
    alternatives: ["laterales1", "laterales_maquina", "laterales_inclinado"]
  },
  laterales_maquina: {
    id: "laterales_maquina",
    name: "Elev. Laterales Máq.",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["laterales1", "laterales_polea_baja", "laterales_inclinado"]
  },
  laterales_inclinado: {
    id: "laterales_inclinado",
    name: "Laterales Banco Incl.",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.0,
    alternatives: ["laterales1", "laterales_polea_baja", "laterales_maquina"]
  },
  triceps1: {
    id: "triceps1",
    name: "Tríceps Polea Alta",
    muscle: "Tríceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["triceps_cuerda", "fondos_paralelas", "triceps_unilateral"]
  },
  triceps_cuerda: {
    id: "triceps_cuerda",
    name: "Tríceps Cuerda",
    muscle: "Tríceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["triceps1", "fondos_paralelas", "triceps_unilateral"]
  },
  fondos_paralelas: {
    id: "fondos_paralelas",
    name: "Fondos en Paralelas",
    muscle: "Tríceps & Pecho",
    rest: 120,
    stepKg: 2.5,
    metricType: "peso_corporal",
    alternatives: ["triceps1", "triceps_cuerda", "triceps_unilateral"]
  },
  triceps_unilateral: {
    id: "triceps_unilateral",
    name: "Tríceps Unilateral",
    muscle: "Tríceps",
    rest: 75,
    stepKg: 1.25,
    metricType: "unilateral",
    alternatives: ["triceps1", "triceps_cuerda", "fondos_paralelas"]
  },
  biceps1: {
    id: "biceps1",
    name: "Curl Bíceps Manc.",
    muscle: "Bíceps",
    rest: 90,
    stepKg: 1.0,
    alternatives: ["curl_barra_z", "curl_polea_baja", "curl_inclinado"]
  },
  curl_barra_z: {
    id: "curl_barra_z",
    name: "Curl con Barra Z",
    muscle: "Bíceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["biceps1", "curl_polea_baja", "curl_inclinado"]
  },
  curl_polea_baja: {
    id: "curl_polea_baja",
    name: "Curl Bíceps Polea",
    muscle: "Bíceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["biceps1", "curl_barra_z", "curl_inclinado"]
  },
  curl_inclinado: {
    id: "curl_inclinado",
    name: "Curl Bíceps Inclinado",
    muscle: "Bíceps",
    rest: 90,
    stepKg: 1.0,
    alternatives: ["biceps1", "curl_barra_z", "curl_polea_baja"]
  },

  // --- PIERNA A ---
  squat: {
    id: "squat",
    name: "Sentadilla Trasera",
    muscle: "Cuádriceps & Glúteo",
    rest: 180,
    stepKg: 5.0,
    alternatives: ["prensa_45", "sentadilla_hack", "sentadilla_multipower"]
  },
  prensa_45: {
    id: "prensa_45",
    name: "Prensa de Piernas 45°",
    muscle: "Cuádriceps & Glúteo",
    rest: 150,
    stepKg: 10.0,
    alternatives: ["squat", "sentadilla_hack", "sentadilla_multipower"]
  },
  sentadilla_hack: {
    id: "sentadilla_hack",
    name: "Sentadilla Hack",
    muscle: "Cuádriceps",
    rest: 150,
    stepKg: 5.0,
    alternatives: ["squat", "prensa_45", "sentadilla_multipower"]
  },
  sentadilla_multipower: {
    id: "sentadilla_multipower",
    name: "Sentadilla Multipower",
    muscle: "Cuádriceps",
    rest: 150,
    stepKg: 5.0,
    alternatives: ["squat", "prensa_45", "sentadilla_hack"]
  },
  legext: {
    id: "legext",
    name: "Extensiones Cuádriceps",
    muscle: "Cuádriceps",
    rest: 90,
    stepKg: 5.0,
    alternatives: ["sentadilla_sissy", "zancadas_caminando", "step_ups"]
  },
  sentadilla_sissy: {
    id: "sentadilla_sissy",
    name: "Sentadilla Sissy",
    muscle: "Cuádriceps",
    rest: 90,
    stepKg: 2.5,
    metricType: "peso_corporal",
    alternatives: ["legext", "zancadas_caminando", "step_ups"]
  },
  zancadas_caminando: {
    id: "zancadas_caminando",
    name: "Zancadas Caminando",
    muscle: "Cuádriceps & Glúteo",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["legext", "sentadilla_sissy", "step_ups"]
  },
  step_ups: {
    id: "step_ups",
    name: "Step-Ups en Cajón",
    muscle: "Cuádriceps & Glúteo",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["legext", "sentadilla_sissy", "zancadas_caminando"]
  },
  curltumbado: {
    id: "curltumbado",
    name: "Curl Femoral Tumbado",
    muscle: "Isquiosurales",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["curl_femoral_sentado", "curl_femoral_unilateral", "curl_femoral_mancuerna"]
  },
  curl_femoral_sentado: {
    id: "curl_femoral_sentado",
    name: "Curl Femoral Sentado",
    muscle: "Isquiosurales",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["curltumbado", "curl_femoral_unilateral", "curl_femoral_mancuerna"]
  },
  curl_femoral_unilateral: {
    id: "curl_femoral_unilateral",
    name: "Curl Femoral De Pie",
    muscle: "Isquiosurales",
    rest: 75,
    stepKg: 2.5,
    metricType: "unilateral",
    alternatives: ["curltumbado", "curl_femoral_sentado", "curl_femoral_mancuerna"]
  },
  curl_femoral_mancuerna: {
    id: "curl_femoral_mancuerna",
    name: "Curl Femoral Manc.",
    muscle: "Isquiosurales",
    rest: 90,
    stepKg: 2.0,
    alternatives: ["curltumbado", "curl_femoral_sentado", "curl_femoral_unilateral"]
  },
  gemelopie: {
    id: "gemelopie",
    name: "Gemelos De Pie",
    muscle: "Gastrocnemio",
    rest: 90,
    stepKg: 5.0,
    alternatives: ["gemelos_prensa", "gemelos_unilateral", "gemelos_multipower"]
  },
  gemelos_prensa: {
    id: "gemelos_prensa",
    name: "Gemelos en Prensa",
    muscle: "Gastrocnemio",
    rest: 90,
    stepKg: 10.0,
    alternatives: ["gemelopie", "gemelos_unilateral", "gemelos_multipower"]
  },
  gemelos_unilateral: {
    id: "gemelos_unilateral",
    name: "Gemelos Unilateral",
    muscle: "Gastrocnemio",
    rest: 75,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["gemelopie", "gemelos_prensa", "gemelos_multipower"]
  },
  gemelos_multipower: {
    id: "gemelos_multipower",
    name: "Gemelos Multipower",
    muscle: "Gastrocnemio",
    rest: 90,
    stepKg: 5.0,
    alternatives: ["gemelopie", "gemelos_prensa", "gemelos_unilateral"]
  },
  plancha: {
    id: "plancha",
    name: "Plancha Abdominal",
    muscle: "Core",
    rest: 60,
    stepKg: 2.5,
    metricType: "isometria",
    alternatives: ["rueda_abdominal", "paseo_granjero", "pallof_press"]
  },
  rueda_abdominal: {
    id: "rueda_abdominal",
    name: "Rueda Abdominal",
    muscle: "Core",
    rest: 75,
    stepKg: 0,
    metricType: "peso_corporal",
    alternatives: ["plancha", "paseo_granjero", "pallof_press"]
  },
  paseo_granjero: {
    id: "paseo_granjero",
    name: "Paseo del Granjero",
    muscle: "Core & Agarre",
    rest: 90,
    stepKg: 2.5,
    metricType: "isometria",
    alternatives: ["plancha", "rueda_abdominal", "pallof_press"]
  },
  pallof_press: {
    id: "pallof_press",
    name: "Press Pallof Polea",
    muscle: "Core",
    rest: 60,
    stepKg: 2.5,
    metricType: "isometria",
    alternatives: ["plancha", "rueda_abdominal", "paseo_granjero"]
  },

  // --- TORSO B ---
  remouni: {
    id: "remouni",
    name: "Remo Unilateral Manc.",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["remo_unilateral_maquina", "remo_pecho_mancuernas", "remo_kroc"]
  },
  remo_unilateral_maquina: {
    id: "remo_unilateral_maquina",
    name: "Remo Unilateral Máq.",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 5.0,
    metricType: "unilateral",
    alternatives: ["remouni", "remo_pecho_mancuernas", "remo_kroc"]
  },
  remo_pecho_mancuernas: {
    id: "remo_pecho_mancuernas",
    name: "Remo Inclinado Manc.",
    muscle: "Espalda Alta",
    rest: 90,
    stepKg: 2.0,
    alternatives: ["remouni", "remo_unilateral_maquina", "remo_kroc"]
  },
  remo_kroc: {
    id: "remo_kroc",
    name: "Kroc Rows Pesados",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["remouni", "remo_unilateral_maquina", "remo_pecho_mancuernas"]
  },
  inclinado: {
    id: "inclinado",
    name: "Press Inclinado Manc.",
    muscle: "Pectoral Clavicular",
    rest: 120,
    stepKg: 2.0,
    alternatives: ["press_inclinado_barra", "press_inclinado_maquina", "press_inclinado_multipower"]
  },
  press_inclinado_barra: {
    id: "press_inclinado_barra",
    name: "Press Inclinado Barra",
    muscle: "Pectoral Clavicular",
    rest: 150,
    stepKg: 2.5,
    alternatives: ["inclinado", "press_inclinado_maquina", "press_inclinado_multipower"]
  },
  press_inclinado_maquina: {
    id: "press_inclinado_maquina",
    name: "Press Inclinado Máq.",
    muscle: "Pectoral Clavicular",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["inclinado", "press_inclinado_barra", "press_inclinado_multipower"]
  },
  press_inclinado_multipower: {
    id: "press_inclinado_multipower",
    name: "Press Incl. Multipower",
    muscle: "Pectoral Clavicular",
    rest: 120,
    stepKg: 2.5,
    alternatives: ["inclinado", "press_inclinado_barra", "press_inclinado_maquina"]
  },
  jalonneutro: {
    id: "jalonneutro",
    name: "Jalón Neutro Cerrado",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["pullover_polea", "dominadas_neutras", "jalon_supino"]
  },
  pullover_polea: {
    id: "pullover_polea",
    name: "Pullover Polea Alta",
    muscle: "Dorsal Ancho",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["jalonneutro", "dominadas_neutras", "jalon_supino"]
  },
  dominadas_neutras: {
    id: "dominadas_neutras",
    name: "Dominadas Neutras",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 2.5,
    metricType: "peso_corporal",
    alternatives: ["jalonneutro", "pullover_polea", "jalon_supino"]
  },
  jalon_supino: {
    id: "jalon_supino",
    name: "Jalón Supino",
    muscle: "Dorsal Ancho",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["jalonneutro", "pullover_polea", "dominadas_neutras"]
  },
  laterales2: {
    id: "laterales2",
    name: "Laterales Polea",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.25,
    alternatives: ["laterales_mancuernas_estrictas", "laterales_maquina_laterales", "laterales_cruzadas_polea"]
  },
  laterales_mancuernas_estrictas: {
    id: "laterales_mancuernas_estrictas",
    name: "Laterales Manc. Pausa",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.0,
    alternatives: ["laterales2", "laterales_maquina_laterales", "laterales_cruzadas_polea"]
  },
  laterales_maquina_laterales: {
    id: "laterales_maquina_laterales",
    name: "Laterales Máquina",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["laterales2", "laterales_mancuernas_estrictas", "laterales_cruzadas_polea"]
  },
  laterales_cruzadas_polea: {
    id: "laterales_cruzadas_polea",
    name: "Laterales Cruzadas Polea",
    muscle: "Deltoides Lateral",
    rest: 75,
    stepKg: 1.25,
    alternatives: ["laterales2", "laterales_mancuernas_estrictas", "laterales_maquina_laterales"]
  },
  facepull: {
    id: "facepull",
    name: "Face Pull Polea",
    muscle: "Deltoides Posterior",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["pajaros_mancuerna", "pajaros_pecdeck", "cruces_polea_inversa"]
  },
  pajaros_mancuerna: {
    id: "pajaros_mancuerna",
    name: "Pájaros Mancuerna",
    muscle: "Deltoides Posterior",
    rest: 75,
    stepKg: 1.0,
    alternatives: ["facepull", "pajaros_pecdeck", "cruces_polea_inversa"]
  },
  pajaros_pecdeck: {
    id: "pajaros_pecdeck",
    name: "Pájaros Pec-Deck",
    muscle: "Deltoides Posterior",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["facepull", "pajaros_mancuerna", "cruces_polea_inversa"]
  },
  cruces_polea_inversa: {
    id: "cruces_polea_inversa",
    name: "Cruces Inversos Polea",
    muscle: "Deltoides Posterior",
    rest: 75,
    stepKg: 1.25,
    alternatives: ["facepull", "pajaros_mancuerna", "pajaros_pecdeck"]
  },
  frances: {
    id: "frances",
    name: "Press Francés",
    muscle: "Tríceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["triceps_trasnuca_polea", "katana_extensions", "press_cerrado_banca"]
  },
  triceps_trasnuca_polea: {
    id: "triceps_trasnuca_polea",
    name: "Tríceps Trasnuca Polea",
    muscle: "Tríceps",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["frances", "katana_extensions", "press_cerrado_banca"]
  },
  katana_extensions: {
    id: "katana_extensions",
    name: "Katana Extensions",
    muscle: "Tríceps",
    rest: 75,
    stepKg: 1.25,
    alternatives: ["frances", "triceps_trasnuca_polea", "press_cerrado_banca"]
  },
  press_cerrado_banca: {
    id: "press_cerrado_banca",
    name: "Press Agarre Estrecho",
    muscle: "Tríceps",
    rest: 120,
    stepKg: 2.5,
    alternatives: ["frances", "triceps_trasnuca_polea", "katana_extensions"]
  },
  martillo: {
    id: "martillo",
    name: "Curl Martillo Manc.",
    muscle: "Braquial & Antebrazo",
    rest: 90,
    stepKg: 1.0,
    alternatives: ["curl_martillo_polea", "curl_inverso_barra", "curl_martillo_predicador"]
  },
  curl_martillo_polea: {
    id: "curl_martillo_polea",
    name: "Curl Martillo Cuerda",
    muscle: "Braquial & Antebrazo",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["martillo", "curl_inverso_barra", "curl_martillo_predicador"]
  },
  curl_inverso_barra: {
    id: "curl_inverso_barra",
    name: "Curl Inverso Barra Z",
    muscle: "Braquiorradial",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["martillo", "curl_martillo_polea", "curl_martillo_predicador"]
  },
  curl_martillo_predicador: {
    id: "curl_martillo_predicador",
    name: "Martillo Predicador",
    muscle: "Braquial",
    rest: 90,
    stepKg: 1.0,
    alternatives: ["martillo", "curl_martillo_polea", "curl_inverso_barra"]
  },

  // --- PIERNA B ---
  rdl: {
    id: "rdl",
    name: "Peso Muerto Rumano",
    muscle: "Isquios & Glúteo",
    rest: 150,
    stepKg: 5.0,
    alternatives: ["rdl_multipower", "rdl_mancuernas", "hip_thrust"]
  },
  rdl_multipower: {
    id: "rdl_multipower",
    name: "RDL Multipower",
    muscle: "Isquios & Glúteo",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["rdl", "rdl_mancuernas", "hip_thrust"]
  },
  rdl_mancuernas: {
    id: "rdl_mancuernas",
    name: "RDL Mancuernas",
    muscle: "Isquios & Glúteo",
    rest: 120,
    stepKg: 4.0,
    alternatives: ["rdl", "rdl_multipower", "hip_thrust"]
  },
  hip_thrust: {
    id: "hip_thrust",
    name: "Hip Thrust con Barra",
    muscle: "Glúteo Mayor",
    rest: 120,
    stepKg: 5.0,
    alternatives: ["rdl", "rdl_multipower", "rdl_mancuernas"]
  },
  bulgarian: {
    id: "bulgarian",
    name: "Sentadilla Búlgara",
    muscle: "Glúteo & Cuádriceps",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["bulgarian_multipower", "prensa_unilateral", "zancadas_estaticas"]
  },
  bulgarian_multipower: {
    id: "bulgarian_multipower",
    name: "Búlgara Multipower",
    muscle: "Glúteo & Cuádriceps",
    rest: 90,
    stepKg: 5.0,
    metricType: "unilateral",
    alternatives: ["bulgarian", "prensa_unilateral", "zancadas_estaticas"]
  },
  prensa_unilateral: {
    id: "prensa_unilateral",
    name: "Prensa Unilateral",
    muscle: "Cuádriceps & Glúteo",
    rest: 90,
    stepKg: 5.0,
    metricType: "unilateral",
    alternatives: ["bulgarian", "bulgarian_multipower", "zancadas_estaticas"]
  },
  zancadas_estaticas: {
    id: "zancadas_estaticas",
    name: "Zancadas Estáticas",
    muscle: "Cuádriceps & Glúteo",
    rest: 90,
    stepKg: 2.0,
    metricType: "unilateral",
    alternatives: ["bulgarian", "bulgarian_multipower", "prensa_unilateral"]
  },
  curlsentado: {
    id: "curlsentado",
    name: "Curl Femoral Sentado",
    muscle: "Isquiosurales",
    rest: 90,
    stepKg: 2.5,
    alternatives: ["curltumbado", "curl_nordico", "curl_pie_polea"]
  },
  curl_nordico: {
    id: "curl_nordico",
    name: "Curl Nórdico Asistido",
    muscle: "Isquiosurales",
    rest: 120,
    stepKg: 0,
    metricType: "peso_corporal",
    alternatives: ["curlsentado", "curltumbado", "curl_pie_polea"]
  },
  curl_pie_polea: {
    id: "curl_pie_polea",
    name: "Curl Isquios Polea Pie",
    muscle: "Isquiosurales",
    rest: 75,
    stepKg: 2.5,
    metricType: "unilateral",
    alternatives: ["curlsentado", "curltumbado", "curl_nordico"]
  },
  legextb: {
    id: "legextb",
    name: "Ext. Cuádriceps Bombeo",
    muscle: "Cuádriceps",
    rest: 75,
    stepKg: 5.0,
    alternatives: ["sentadilla_goblet", "prensa_pies_bajos", "sissy_squat"]
  },
  sentadilla_goblet: {
    id: "sentadilla_goblet",
    name: "Sentadilla Goblet",
    muscle: "Cuádriceps",
    rest: 75,
    stepKg: 2.0,
    alternatives: ["legextb", "prensa_pies_bajos", "sissy_squat"]
  },
  prensa_pies_bajos: {
    id: "prensa_pies_bajos",
    name: "Prensa Pies Bajos",
    muscle: "Cuádriceps",
    rest: 90,
    stepKg: 10.0,
    alternatives: ["legextb", "sentadilla_goblet", "sissy_squat"]
  },
  sissy_squat: {
    id: "sissy_squat",
    name: "Sentadilla Sissy",
    muscle: "Recto Femoral",
    rest: 75,
    stepKg: 2.5,
    metricType: "peso_corporal",
    alternatives: ["legextb", "sentadilla_goblet", "prensa_pies_bajos"]
  },
  gemelosentado: {
    id: "gemelosentado",
    name: "Gemelo Sentado Máq.",
    muscle: "Sóleo",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["gemelo_sentado_barra", "gemelo_sentado_multipower", "gemelo_prensa_flex"]
  },
  gemelo_sentado_barra: {
    id: "gemelo_sentado_barra",
    name: "Gemelo Sentado Barra",
    muscle: "Sóleo",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["gemelosentado", "gemelo_sentado_multipower", "gemelo_prensa_flex"]
  },
  gemelo_sentado_multipower: {
    id: "gemelo_sentado_multipower",
    name: "Gemelo Sent. Multipower",
    muscle: "Sóleo",
    rest: 75,
    stepKg: 5.0,
    alternatives: ["gemelosentado", "gemelo_sentado_barra", "gemelo_prensa_flex"]
  },
  gemelo_prensa_flex: {
    id: "gemelo_prensa_flex",
    name: "Gemelo Prensa Flex.",
    muscle: "Sóleo & Gastrocnemio",
    rest: 75,
    stepKg: 10.0,
    alternatives: ["gemelosentado", "gemelo_sentado_barra", "gemelo_sentado_multipower"]
  },
  crunch: {
    id: "crunch",
    name: "Crunch Polea Alta",
    muscle: "Recto Abdominal",
    rest: 75,
    stepKg: 2.5,
    alternatives: ["elevacion_piernas", "crunch_suelo_lastrado", "crunch_maquina"]
  },
  elevacion_piernas: {
    id: "elevacion_piernas",
    name: "Elevación Piernas Barra",
    muscle: "Abdomen Inferior",
    rest: 75,
    stepKg: 0,
    metricType: "peso_corporal",
    alternatives: ["crunch", "crunch_suelo_lastrado", "crunch_maquina"]
  },
  crunch_suelo_lastrado: {
    id: "crunch_suelo_lastrado",
    name: "Crunch Suelo Disco",
    muscle: "Recto Abdominal",
    rest: 60,
    stepKg: 2.5,
    alternatives: ["crunch", "elevacion_piernas", "crunch_maquina"]
  },
  crunch_maquina: {
    id: "crunch_maquina",
    name: "Crunch en Máquina",
    muscle: "Recto Abdominal",
    rest: 75,
    stepKg: 5.0,
    alternatives: ["crunch", "elevacion_piernas", "crunch_suelo_lastrado"]
  }
};
