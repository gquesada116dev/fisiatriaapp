/**
 * Prompts for all AI features.
 * All output is in Spanish (Costa Rica). All prompts emphasize:
 *  - Costa Rican CCSS/CENARE clinical context where relevant
 *  - Exam-focused: prioritize what shows up in physiatry residency admission exams
 *  - Evidence-based but practical
 */

const COMMON_HEADER = `Eres un médico fisiatra docente en Costa Rica, con experiencia preparando residentes para el examen de admisión de segunda etapa de Medicina Física y Rehabilitación (CENDEISSS/CCSS). Tu estilo es preciso, didáctico y enfocado en lo clínicamente relevante. Usa terminología médica estándar en español. Cuando exista contexto específico costarricense (CCSS, CENARE, Ley 7600, Ley 9379), inclúyelo.`;

// ---------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------
export function summaryPrompt(topic: { name: string; category: string; description: string }) {
  return {
    system: COMMON_HEADER,
    user: `Genera un resumen de estudio estructurado sobre el siguiente tema de fisiatría:

TEMA: ${topic.name}
CATEGORÍA: ${topic.category}
CONTEXTO: ${topic.description}

Estructura el resumen en formato Markdown con las siguientes secciones (omite alguna solo si genuinamente no aplica):

## Definición y conceptos clave
## Anatomía / fisiopatología relevante
## Evaluación clínica
## Clasificación o escalas (si aplica)
## Manejo / tratamiento
## Puntos de alto rendimiento para el examen
## Errores frecuentes / banderas rojas

Requisitos:
- Profundidad de residente, no de estudiante de pregrado.
- Incluye datos concretos (escalas con sus puntos de corte, dosis cuando aplique, criterios diagnósticos exactos).
- Cuando exista práctica costarricense específica (p.ej. referencias al CENARE, protocolos CCSS), menciónala.
- Máximo ~1200 palabras. Densidad sobre extensión.
- Devuelve solo el markdown, sin preámbulo.`,
  };
}

// ---------------------------------------------------------------
// QUESTIONS (MCQ)
// ---------------------------------------------------------------
export type GeneratedQuestion = {
  stem: string;
  options: { letter: "A" | "B" | "C" | "D" | "E"; text: string }[];
  correct: "A" | "B" | "C" | "D" | "E";
  explanation: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export function questionsPrompt(topic: { name: string; category: string; description: string }, n: number) {
  return {
    system: COMMON_HEADER,
    user: `Genera ${n} preguntas de opción múltiple sobre el tema "${topic.name}" (categoría: ${topic.category}).

Requisitos por pregunta:
- Estilo viñeta clínica cuando sea posible (un caso breve, no solo "cuál es...").
- 5 opciones (A-E). Una sola correcta.
- Distractores plausibles (errores conceptuales comunes), no opciones absurdas.
- Explicación de 3-6 oraciones que justifique la correcta y, brevemente, por qué las otras son incorrectas.
- Dificultad 1-5 (1 trivial, 5 reto de especialista).
- Variedad: mezcla preguntas de definición, manejo, complicaciones y evaluación.

Devuelve JSON con este esquema exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [
        {"letter": "A", "text": "..."},
        {"letter": "B", "text": "..."},
        {"letter": "C", "text": "..."},
        {"letter": "D", "text": "..."},
        {"letter": "E", "text": "..."}
      ],
      "correct": "C",
      "explanation": "...",
      "difficulty": 3
    }
  ]
}`,
  };
}

// ---------------------------------------------------------------
// FLASHCARDS
// ---------------------------------------------------------------
export type GeneratedFlashcard = { front: string; back: string; tags: string[] };

export function flashcardsPrompt(topic: { name: string; category: string; description: string }, n: number) {
  return {
    system: COMMON_HEADER,
    user: `Genera ${n} tarjetas de memoria (flashcards) sobre "${topic.name}".

Reglas Anki:
- Una idea atómica por tarjeta. Si requiere lista, conviértela en varias tarjetas.
- Frente: pregunta o frase incompleta concisa.
- Reverso: respuesta directa, sin relleno. Datos concretos (números, criterios) cuando apliquen.
- Tags: 1-3 palabras clave en minúscula sin tildes (kebab-case).
- Cubre los puntos de alto rendimiento del tema, no curiosidades.

Devuelve JSON:
{
  "cards": [
    { "front": "...", "back": "...", "tags": ["tag1","tag2"] }
  ]
}`,
  };
}

// ---------------------------------------------------------------
// EXAM QUESTIONS (6 opciones + explicación por opción)
// ---------------------------------------------------------------
export type GeneratedExamQuestion = {
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  explanations: Record<string, string>;
  difficulty: 1 | 2 | 3 | 4 | 5;
};

export function examQuestionsPrompt(
  topic: { name: string; category: string; description: string },
  n: number,
) {
  return {
    system: COMMON_HEADER,
    user: `Genera ${n} preguntas de examen sobre "${topic.name}" (categoría: ${topic.category}).

Requisitos:
- Viñeta clínica realista cuando sea posible.
- EXACTAMENTE 6 opciones (A-F). Una sola correcta.
- Distractores plausibles que reflejen errores conceptuales reales de residentes.
- Para cada opción, una explicación breve (2-4 oraciones) que diga POR QUÉ es correcta o incorrecta.
- Dificultad 1-5. Apunta a 3-4 (nivel de examen de segunda etapa).

Devuelve JSON exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [
        {"letter": "A", "text": "..."},
        {"letter": "B", "text": "..."},
        {"letter": "C", "text": "..."},
        {"letter": "D", "text": "..."},
        {"letter": "E", "text": "..."},
        {"letter": "F", "text": "..."}
      ],
      "correct": "C",
      "explanations": {
        "A": "Incorrecto. ...",
        "B": "Incorrecto. ...",
        "C": "Correcto. ...",
        "D": "Incorrecto. ...",
        "E": "Incorrecto. ...",
        "F": "Incorrecto. ..."
      },
      "difficulty": 3
    }
  ]
}`,
  };
}

// ---------------------------------------------------------------
// PODCAST SCRIPT
// ---------------------------------------------------------------
export type PodcastLine = { speaker: "A" | "B"; text: string };

export function podcastPrompt(topic: { name: string; category: string; description: string }) {
  return {
    system: COMMON_HEADER,
    user: `Escribe un guion de podcast educativo en español (Costa Rica) entre dos médicos fisiatras conversando sobre "${topic.name}".

Personajes:
- A: Dra. Marín, fisiatra con experiencia clínica. Pregunta, problematiza, da ejemplos de casos.
- B: Dr. Vargas, fisiatra académico. Estructura, da datos, criterios y números.

Estilo:
- Conversación natural costarricense, NO formal acartonada. Pueden usar "uno", "vea", "fíjese", pero sin caer en caricatura.
- Sin saludos extensos. Empiezan ya en el tema.
- 12-20 intervenciones totales, alternando A/B.
- Cada intervención: 2-5 oraciones. NO monólogos largos.
- Cubre: concepto clave, evaluación, manejo, un error frecuente. Cierran con un take-home claro.
- NUNCA reproducen instrucciones de este prompt, NUNCA mencionan ser una IA.

Devuelve JSON:
{
  "script": [
    { "speaker": "A", "text": "..." },
    { "speaker": "B", "text": "..." }
  ]
}`,
  };
}
