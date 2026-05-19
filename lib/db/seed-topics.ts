/**
 * Canonical topic list for FisiaPrep.
 * Slugs are derived from name (kebab-case, no accents).
 * Priority (1-5) reflects rough likelihood of exam appearance.
 */

export type SeedTopic = {
  category: string;
  name: string;
  slug: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
};

export const SEED_TOPICS: SeedTopic[] = [
  // 1. Fundamentos
  { category: "Fundamentos", name: "Anatomía musculoesquelética aplicada", slug: "anatomia-musculoesqueletica-aplicada", description: "Estructuras óseas, articulares, musculares y nerviosas relevantes para la práctica fisiátrica.", priority: 4 },
  { category: "Fundamentos", name: "Neuroanatomía funcional", slug: "neuroanatomia-funcional", description: "Vías motoras, sensitivas, cerebelosas y de control postural aplicadas a la rehabilitación.", priority: 4 },
  { category: "Fundamentos", name: "Biomecánica de la marcha", slug: "biomecanica-de-la-marcha", description: "Fases del ciclo de la marcha, parámetros espacio-temporales y patrones patológicos.", priority: 5 },
  { category: "Fundamentos", name: "Biomecánica del aparato locomotor", slug: "biomecanica-aparato-locomotor", description: "Cinemática y cinética articular, palancas, momentos de fuerza.", priority: 3 },
  { category: "Fundamentos", name: "Fisiología del ejercicio", slug: "fisiologia-del-ejercicio", description: "Adaptaciones cardiovasculares, musculares y metabólicas al ejercicio.", priority: 3 },
  { category: "Fundamentos", name: "Clasificación Internacional del Funcionamiento (CIF/OMS)", slug: "cif-oms", description: "Modelo biopsicosocial, dominios de funcionamiento y discapacidad.", priority: 4 },

  // 2. Evaluación Funcional
  { category: "Evaluación Funcional", name: "Escalas de medición (Barthel, FIM, Lawton)", slug: "escalas-barthel-fim-lawton", description: "Escalas de actividades de la vida diaria básicas e instrumentales.", priority: 5 },
  { category: "Evaluación Funcional", name: "Escala de Ashworth modificada (espasticidad)", slug: "ashworth-modificada", description: "Graduación clínica de la espasticidad.", priority: 5 },
  { category: "Evaluación Funcional", name: "Clasificación ASIA (lesión medular)", slug: "asia-lesion-medular", description: "Determinación de nivel neurológico y completitud según ASIA/ISNCSCI.", priority: 5 },
  { category: "Evaluación Funcional", name: "NIHSS y escalas post-ACV", slug: "nihss-post-acv", description: "Severidad del ictus y escalas pronósticas funcionales.", priority: 4 },
  { category: "Evaluación Funcional", name: "Glasgow y escalas post-TCE", slug: "glasgow-post-tce", description: "Severidad inicial y pronóstico funcional tras TCE.", priority: 4 },
  { category: "Evaluación Funcional", name: "Evaluación del dolor (EVA, McGill, DN4)", slug: "evaluacion-del-dolor", description: "Instrumentos de medición uni y multidimensional del dolor.", priority: 4 },

  // 3. Lesión Medular
  { category: "Lesión Medular", name: "Clasificación ASIA y nivel neurológico", slug: "lm-asia-nivel-neurologico", description: "Determinación del nivel motor, sensitivo y escala de discapacidad ASIA.", priority: 5 },
  { category: "Lesión Medular", name: "Vejiga neurogénica", slug: "vejiga-neurogenica", description: "Tipos, evaluación urodinámica y manejo de la vejiga neurogénica.", priority: 5 },
  { category: "Lesión Medular", name: "Intestino neurogénico", slug: "intestino-neurogenico", description: "Patrones (reflejo vs arrefléxico) y programa intestinal.", priority: 4 },
  { category: "Lesión Medular", name: "Espasticidad post-lesión medular", slug: "espasticidad-lm", description: "Evaluación y manejo escalonado de la espasticidad.", priority: 5 },
  { category: "Lesión Medular", name: "Disreflexia autonómica", slug: "disreflexia-autonomica", description: "Reconocimiento y manejo de la emergencia autonómica.", priority: 5 },
  { category: "Lesión Medular", name: "Úlceras por presión", slug: "ulceras-por-presion", description: "Estadificación, prevención y tratamiento.", priority: 4 },
  { category: "Lesión Medular", name: "Rehabilitación funcional según nivel", slug: "rehab-funcional-por-nivel", description: "Metas funcionales esperables por nivel neurológico.", priority: 5 },

  // 4. ACV / Ictus
  { category: "ACV / Ictus", name: "Rehabilitación motora del hemipléjico", slug: "rehab-motora-hemiplejico", description: "Recuperación motora, abordajes neurofacilitadores.", priority: 5 },
  { category: "ACV / Ictus", name: "Afasias y rehabilitación del lenguaje", slug: "afasias-rehab-lenguaje", description: "Clasificación de afasias y principios de rehabilitación logopédica.", priority: 4 },
  { category: "ACV / Ictus", name: "Disfagia post-ACV", slug: "disfagia-post-acv", description: "Tamizaje, evaluación instrumental y manejo.", priority: 5 },
  { category: "ACV / Ictus", name: "Hombro doloroso del hemipléjico", slug: "hombro-doloroso-hemiplejico", description: "Subluxación, capsulitis y manejo del hombro hemipléjico.", priority: 4 },
  { category: "ACV / Ictus", name: "Espasticidad post-ACV", slug: "espasticidad-acv", description: "Patrones espásticos típicos y manejo (toxina botulínica incluida).", priority: 5 },
  { category: "ACV / Ictus", name: "Recuperación cognitiva", slug: "recuperacion-cognitiva-acv", description: "Heminegligencia, déficit ejecutivo y abordaje cognitivo.", priority: 3 },

  // 5. TCE
  { category: "TCE", name: "Escalas (Glasgow, Rancho Los Amigos)", slug: "tce-escalas", description: "Severidad inicial (GCS) y estadios de recuperación cognitiva (RLA).", priority: 4 },
  { category: "TCE", name: "Rehabilitación cognitivo-conductual", slug: "rehab-cognitivo-conductual-tce", description: "Estrategias de rehabilitación de la atención, memoria y función ejecutiva.", priority: 4 },
  { category: "TCE", name: "Manejo de agitación", slug: "manejo-agitacion-tce", description: "Estrategias no farmacológicas y farmacológicas en RLA III-V.", priority: 3 },
  { category: "TCE", name: "Disautonomía paroxística", slug: "disautonomia-paroxistica", description: "Reconocimiento y manejo de la hiperactividad simpática paroxística.", priority: 3 },

  // 6. Pediátrica
  { category: "Pediátrica", name: "Parálisis cerebral infantil (GMFCS)", slug: "pci-gmfcs", description: "Clasificación GMFCS y manejo integral de la PCI.", priority: 5 },
  { category: "Pediátrica", name: "Mielomeningocele", slug: "mielomeningocele", description: "Niveles funcionales y rehabilitación del mielomeningocele.", priority: 4 },
  { category: "Pediátrica", name: "Distrofias musculares", slug: "distrofias-musculares", description: "Duchenne y otras distrofias: progresión y manejo rehabilitador.", priority: 3 },
  { category: "Pediátrica", name: "Trastornos del neurodesarrollo", slug: "trastornos-neurodesarrollo", description: "Hitos del desarrollo y abordaje temprano.", priority: 3 },

  // 7. Amputaciones
  { category: "Amputaciones", name: "Niveles de amputación", slug: "niveles-amputacion", description: "Niveles, indicaciones y consecuencias funcionales.", priority: 4 },
  { category: "Amputaciones", name: "Cuidado del muñón", slug: "cuidado-del-munon", description: "Vendaje, modelaje y prevención de complicaciones.", priority: 4 },
  { category: "Amputaciones", name: "Prescripción de prótesis miembro inferior", slug: "protesis-mi", description: "Componentes protésicos y prescripción según nivel.", priority: 5 },
  { category: "Amputaciones", name: "Prescripción de prótesis miembro superior", slug: "protesis-ms", description: "Prótesis pasivas, mecánicas y mioeléctricas.", priority: 3 },
  { category: "Amputaciones", name: "Marcha protésica", slug: "marcha-protesica", description: "Patrones normales y alteraciones de la marcha protésica.", priority: 4 },

  // 8. Dolor
  { category: "Dolor", name: "Dolor agudo vs crónico", slug: "dolor-agudo-cronico", description: "Mecanismos, evaluación y principios terapéuticos.", priority: 4 },
  { category: "Dolor", name: "Dolor neuropático", slug: "dolor-neuropatico", description: "Mecanismos, diagnóstico (DN4) y manejo farmacológico escalonado.", priority: 5 },
  { category: "Dolor", name: "Lumbalgia (mecánica, radicular, banderas rojas)", slug: "lumbalgia", description: "Clasificación, banderas rojas y manejo basado en evidencia.", priority: 5 },
  { category: "Dolor", name: "Cervicalgia", slug: "cervicalgia", description: "Cervicalgia mecánica, radiculopatía y mielopatía cervical.", priority: 4 },
  { category: "Dolor", name: "Síndrome doloroso regional complejo", slug: "sdrc", description: "Criterios de Budapest y manejo multimodal.", priority: 3 },
  { category: "Dolor", name: "Fibromialgia", slug: "fibromialgia", description: "Criterios ACR y manejo no farmacológico/farmacológico.", priority: 3 },

  // 9. Musculoesquelético y Deportivo
  { category: "Musculoesquelético", name: "Lesiones de hombro (manguito rotador, capsulitis)", slug: "lesiones-hombro", description: "Diagnóstico y rehabilitación de patologías de hombro.", priority: 4 },
  { category: "Musculoesquelético", name: "Lesiones de rodilla (LCA, meniscos)", slug: "lesiones-rodilla", description: "Manejo conservador y post-quirúrgico de lesiones de rodilla.", priority: 4 },
  { category: "Musculoesquelético", name: "Tendinopatías", slug: "tendinopatias", description: "Fisiopatología y rehabilitación con ejercicio excéntrico.", priority: 3 },
  { category: "Musculoesquelético", name: "Rehabilitación post-fractura", slug: "rehab-post-fractura", description: "Fases de consolidación y progresión rehabilitadora.", priority: 3 },
  { category: "Musculoesquelético", name: "Medicina deportiva", slug: "medicina-deportiva", description: "Evaluación del deportista y retorno al deporte.", priority: 2 },

  // 10. Procedimientos
  { category: "Procedimientos", name: "Electromiografía y velocidad de conducción", slug: "emg-vcn", description: "Indicaciones, interpretación y hallazgos típicos.", priority: 5 },
  { category: "Procedimientos", name: "Toxina botulínica para espasticidad", slug: "toxina-botulinica", description: "Indicaciones, dosis y técnica de aplicación.", priority: 5 },
  { category: "Procedimientos", name: "Infiltraciones articulares y partes blandas", slug: "infiltraciones", description: "Indicaciones y técnica de infiltración con corticoides/AH.", priority: 3 },
  { category: "Procedimientos", name: "Bloqueos nerviosos", slug: "bloqueos-nerviosos", description: "Bloqueos diagnósticos y terapéuticos.", priority: 3 },
  { category: "Procedimientos", name: "Ondas de choque", slug: "ondas-de-choque", description: "Indicaciones, mecanismo y evidencia.", priority: 2 },
  { category: "Procedimientos", name: "Ecografía musculoesquelética", slug: "ecografia-mse", description: "Principios y aplicaciones diagnósticas e intervencionistas.", priority: 3 },

  // 11. Ortesis
  { category: "Ortesis", name: "Ortesis miembro inferior", slug: "ortesis-mi", description: "AFO, KAFO y otras ortesis de miembro inferior.", priority: 4 },
  { category: "Ortesis", name: "Ortesis miembro superior", slug: "ortesis-ms", description: "Férulas de mano, muñeca y codo.", priority: 3 },
  { category: "Ortesis", name: "Ortesis de columna", slug: "ortesis-columna", description: "Corsés y collarines: indicaciones por patología.", priority: 3 },
  { category: "Ortesis", name: "Sillas de ruedas (prescripción)", slug: "prescripcion-silla-de-ruedas", description: "Antropometría, medidas y prescripción individualizada.", priority: 4 },
  { category: "Ortesis", name: "Ayudas para la marcha", slug: "ayudas-marcha", description: "Bastones, andadores, muletas: indicación y ajuste.", priority: 4 },

  // 12. Agentes Físicos
  { category: "Agentes Físicos", name: "Termoterapia (calor y frío)", slug: "termoterapia", description: "Indicaciones, contraindicaciones y efectos fisiológicos.", priority: 3 },
  { category: "Agentes Físicos", name: "Electroterapia (TENS, corrientes)", slug: "electroterapia", description: "Modalidades, parámetros y evidencia.", priority: 3 },
  { category: "Agentes Físicos", name: "Ultrasonido terapéutico", slug: "ultrasonido-terapeutico", description: "Parámetros, indicaciones y contraindicaciones.", priority: 2 },
  { category: "Agentes Físicos", name: "Magnetoterapia", slug: "magnetoterapia", description: "Evidencia y aplicaciones clínicas.", priority: 1 },
  { category: "Agentes Físicos", name: "Hidroterapia", slug: "hidroterapia", description: "Principios físicos y aplicación terapéutica.", priority: 2 },

  // 13. Patología Específica
  { category: "Patología Específica", name: "Rehabilitación cardiopulmonar", slug: "rehab-cardiopulmonar", description: "Programas de rehabilitación cardiaca y pulmonar.", priority: 3 },
  { category: "Patología Específica", name: "Rehabilitación oncológica y linfedema", slug: "rehab-oncologica-linfedema", description: "Manejo integral del paciente oncológico y del linfedema.", priority: 3 },
  { category: "Patología Específica", name: "Rehabilitación en quemados", slug: "rehab-quemados", description: "Manejo de cicatrices, contracturas y función.", priority: 2 },
  { category: "Patología Específica", name: "Rehabilitación geriátrica", slug: "rehab-geriatrica", description: "Síndromes geriátricos y rehabilitación del adulto mayor.", priority: 3 },
  { category: "Patología Específica", name: "Reumatología funcional (AR, espondiloartropatías)", slug: "reumatologia-funcional", description: "Manejo rehabilitador en patología reumática.", priority: 3 },

  // 14. Contexto Costa Rica
  { category: "Contexto Costa Rica", name: "Historia de la fisiatría en CR y CENARE", slug: "historia-fisiatria-cr-cenare", description: "Desarrollo histórico de la especialidad en Costa Rica y el rol del CENARE.", priority: 3 },
  { category: "Contexto Costa Rica", name: "Sistema de rehabilitación de la CCSS", slug: "sistema-rehab-ccss", description: "Organización de servicios de rehabilitación en la CCSS.", priority: 3 },
  { category: "Contexto Costa Rica", name: "Marco legal de discapacidad en CR (Ley 7600, Ley 9379)", slug: "marco-legal-discapacidad-cr", description: "Ley 7600 (Igualdad de Oportunidades) y Ley 9379 (Autonomía Personal).", priority: 4 },
];
