/**
 * Canonical topic list for FisiaPrep.
 * Based on the official MFR residency exam curriculum.
 * Sources: Frontera et al. Manual MFR 4ª ed. (2020) · Braddom's PMR 5ª ed. (2016)
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
  // 1. Grandes Síndromes en Rehabilitación
  { category: "Grandes Síndromes en Rehabilitación", name: "Amputaciones de la extremidad inferior", slug: "amputaciones-extremidad-inferior", description: "Niveles de amputación, cuidado del muñón, prescripción protésica y rehabilitación de la marcha. (Frontera cap 120)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Rehabilitación cardiaca", slug: "rehabilitacion-cardiaca", description: "Fases del programa de rehabilitación cardiaca, estratificación de riesgo y prescripción del ejercicio. (Frontera cap 123)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Parálisis cerebral infantil", slug: "paralisis-cerebral-infantil", description: "Clasificación GMFCS, tipos clínicos, manejo de espasticidad y metas funcionales en PCI. (Frontera cap 125)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Enfermedades de neurona motora", slug: "enfermedades-neurona-motora", description: "ELA y otras ENM: progresión, manejo rehabilitador y paliativo, comunicación aumentativa. (Frontera cap 133)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Miopatías", slug: "miopatias", description: "Distrofias musculares y miopatías inflamatorias: evaluación funcional, respiratoria y programa de ejercicio. (Frontera cap 136)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Defectos del tubo neural", slug: "defectos-tubo-neural", description: "Mielomeningocele: niveles funcionales, complicaciones asociadas (hidrocefalia, Chiari II) y rehabilitación. (Frontera cap 137)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Artrosis", slug: "artrosis", description: "Fisiopatología, evaluación funcional, manejo conservador y rehabilitación de la artrosis de cadera y rodilla. (Frontera cap 140)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Neuropatías periféricas", slug: "neuropatias-perifericas", description: "Clasificación, electrodiagnóstico, manejo rehabilitador del dolor neuropático y de la función motora. (Frontera cap 143)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Rehabilitación del politrauma", slug: "rehabilitacion-politrauma", description: "Abordaje integral del paciente politraumático: evaluación temprana, prevención de complicaciones y reinserción. (Frontera cap 146)", priority: 4 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Úlceras por presión", slug: "ulceras-por-presion", description: "Estadificación, factores de riesgo, prevención y tratamiento local de las úlceras por presión. (Frontera cap 149)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Escoliosis y cifosis", slug: "escoliosis-y-cifosis", description: "Clasificación, evaluación radiológica (Cobb), ortesis y seguimiento de las deformidades de columna. (Frontera cap 153)", priority: 3 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Espasticidad", slug: "espasticidad", description: "Mecanismos, escalas de evaluación (Ashworth, Tardieu) y manejo escalonado incluyendo toxina botulínica. (Frontera cap 154)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Lesiones medulares — Clasificación y fisiopatología (cap 156)", slug: "lesiones-medulares-cap-156", description: "Epidemiología, clasificación ASIA/ISNCSCI, fisiopatología del daño primario y secundario en lesión medular. (Frontera cap 156)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Lesiones medulares — Complicaciones médicas (cap 157)", slug: "lesiones-medulares-cap-157", description: "Disreflexia autonómica, vejiga neurogénica, intestino neurogénico, dolor y otras complicaciones. (Frontera cap 157)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Lesiones medulares — Rehabilitación funcional (cap 158)", slug: "lesiones-medulares-cap-158", description: "Metas funcionales por nivel neurológico, prescripción de silla de ruedas, ortesis y reintegración social. (Frontera cap 158)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Evento cerebrovascular", slug: "evento-cerebrovascular", description: "Rehabilitación post-ACV: recuperación motora, manejo de espasticidad, afasia, disfagia y cognición. (Frontera cap 159)", priority: 5 },
  { category: "Grandes Síndromes en Rehabilitación", name: "Lesión cerebral traumática", slug: "lesion-cerebral-traumatica", description: "Escalas pronósticas (GCS, Rancho Los Amigos), rehabilitación cognitivo-conductual y reinserción. (Frontera cap 163)", priority: 5 },

  // 2. Algología
  { category: "Algología", name: "Síndrome Regional Complejo Doloroso", slug: "sindrome-regional-complejo-doloroso", description: "Criterios diagnósticos de Budapest, fisiopatología y manejo multimodal del SRCD tipo I y II. (Frontera cap 100)", priority: 4 },
  { category: "Algología", name: "Síndrome de dolor miofascial", slug: "sindrome-dolor-miofascial", description: "Puntos gatillo, diagnóstico clínico y tratamiento (punción seca, infiltración, terapia manual). (Frontera cap 105)", priority: 4 },
  { category: "Algología", name: "Fibromialgia", slug: "fibromialgia", description: "Criterios ACR 2010, fisiopatología central y manejo multimodal no farmacológico y farmacológico. (Frontera cap 102)", priority: 3 },
  { category: "Algología", name: "Neuralgia postherpética", slug: "neuralgia-posherpetica", description: "Fisiopatología, factores de riesgo y tratamiento farmacológico de la neuralgia post-herpética. (Frontera cap 109)", priority: 3 },
  { category: "Algología", name: "Neuralgia del trigémino", slug: "neuralgia-del-trigemino", description: "Criterios diagnósticos, diagnóstico diferencial y opciones terapéuticas (médico, invasivo). (Frontera cap 118)", priority: 3 },

  // 3. Derechos de las Personas con Discapacidad
  { category: "Derechos de las Personas con Discapacidad", name: "Informe Mundial sobre Discapacidad 2011", slug: "informe-mundial-discapacidad-2011", description: "Principales hallazgos del Informe OMS/Banco Mundial 2011: barreras, epidemiología global y recomendaciones en salud, rehabilitación y entorno.", priority: 3 },

  // 4. Conceptos Básicos de Manejo Fisiátrico
  { category: "Conceptos Básicos de Manejo Fisiátrico", name: "Historia clínica y examen físico fisiátrico", slug: "historia-clinica-examen-fisico-fisiátrico", description: "Estructura de la historia clínica fisiátrica, examen musculoesquelético, neurológico y funcional del adulto. (Frontera cap 1, pág 3-39)", priority: 4 },
  { category: "Conceptos Básicos de Manejo Fisiátrico", name: "Historia y examen físico del paciente pediátrico", slug: "historia-examen-fisico-pediatrico", description: "Particularidades de la anamnesis y exploración fisiátrica en pediatría, hitos del desarrollo motor. (Frontera cap 2, pág 41-51)", priority: 3 },
];
