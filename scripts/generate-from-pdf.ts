/**
 * Generates summary, questions, and flashcards for a single topic
 * using extracted PDF chapter text as source context, with prompt caching.
 *
 * Cache strategy:
 *   - System prompt    → cached (ephemeral, ~5 min TTL)
 *   - Chapter text     → cached (ephemeral, ~5 min TTL)
 *   - Task instruction → NOT cached (changes per call)
 *
 * Cost per chapter: ~$0.26 without caching → ~$0.17 with caching (~35% savings)
 *
 * Usage:
 *   npm run generate:from-pdf -- --slug=amputaciones-extremidad-inferior
 *   npm run generate:from-pdf -- --slug=amputaciones-extremidad-inferior --force
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

if (!getApps().length) {
  const pk = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: pk,
    }),
  });
}

const db = getFirestore();
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
if (!SLUG) { console.error("Falta --slug=<topic-slug>"); process.exit(1); }

const FORCE = process.argv.includes("--force");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1] ?? null;
// El podcast solo genera el guión (no el audio). Desactivado por defecto:
// no se está produciendo audio en ElevenLabs. Usar --podcast para reactivarlo.
const WITH_PODCAST = process.argv.includes("--podcast");
const CARDS_PER_TOPIC = 50;
const QUESTIONS_PER_TOPIC = 7;
const EXAM_QUESTIONS_PER_TOPIC = 5;
const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

// Running totals for cost reporting
const usage = { cacheWrite: 0, cacheRead: 0, input: 0, output: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

const SYSTEM_BASE = `Eres un médico fisiatra docente en Costa Rica (CENDEISSS/CCSS/CENARE), preparando residentes para el examen de admisión de segunda etapa de Medicina Física y Rehabilitación.

REGLA FUNDAMENTAL: Todo dato, estadística, clasificación y terminología que uses debe provenir ÚNICAMENTE del texto del capítulo que se te adjunta. No agregues información externa que no esté en ese texto. Si el capítulo define o prefiere un término (por ejemplo "extremidad residual" en vez de un término antiguo), úsalo exactamente así — el capítulo es la fuente de verdad. Cuando el capítulo remarque un cambio de terminología o una actualización conceptual, destácalo explícitamente como punto de enseñanza.

Bibliografía base: Manual de MFR de Frontera/Silver/Rizzo 4ª ed. (2020) y Braddom's PMR 6ª ed. (2021). El texto del capítulo es la fuente primaria.`;

type CachedCallParams = {
  model: string;
  chapterText: string;
  taskPrompt: string;
  imageBlocks?: (Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam | Anthropic.ImageBlockParam)[];
  maxTokens: number;
  jsonMode?: boolean;
};

async function callCached(params: CachedCallParams): Promise<string> {
  // System block is IDENTICAL for all calls → cached after first write, read on all subsequent
  const systemBlocks: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
  ];

  // Chapter text is the cacheable prefix — identical across all calls for this chapter
  // If the text contains a secondary source (Braddom), split and label clearly
  const secondaryMarker = "=== FUENTE SECUNDARIA";
  const secondaryIdx = params.chapterText.indexOf(secondaryMarker);
  const primaryText = secondaryIdx !== -1
    ? params.chapterText.slice(0, secondaryIdx).trim()
    : params.chapterText;
  const secondaryText = secondaryIdx !== -1
    ? params.chapterText.slice(secondaryIdx).trim()
    : null;

  const chapterContent = secondaryText
    ? `--- FUENTE PRIMARIA (Frontera) — úsala como base principal ---\n${primaryText}\n--- FIN FUENTE PRIMARIA ---\n\n--- FUENTE SECUNDARIA (Braddom) — úsala SOLO para agregar lo que NO esté cubierto en Frontera ---\n${secondaryText}\n--- FIN FUENTE SECUNDARIA ---`
    : `--- TEXTO DEL CAPÍTULO ---\n${primaryText}\n--- FIN DEL CAPÍTULO ---`;

  const chapterBlock: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam = {
    type: "text",
    text: chapterContent,
    cache_control: { type: "ephemeral" },
  };

  // Task-specific instructions — NOT cached, different per call
  // JSON instruction goes here (not in system) so system block stays identical → cache hits
  const taskText = params.jsonMode
    ? params.taskPrompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no preamble."
    : params.taskPrompt;
  const taskBlock: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam = {
    type: "text",
    text: taskText,
  };

  const userContent: (Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam | Anthropic.ImageBlockParam)[] = [
    chapterBlock,
    taskBlock,
    ...(params.imageBlocks ?? []),
  ];

  const resp = await ai.beta.promptCaching.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    system: systemBlocks,
    messages: [{ role: "user", content: userContent }],
  });

  // Accumulate usage for cost report
  const u = resp.usage as any;
  usage.cacheWrite += u.cache_creation_input_tokens ?? 0;
  usage.cacheRead  += u.cache_read_input_tokens ?? 0;
  usage.input      += u.input_tokens ?? 0;
  usage.output     += u.output_tokens ?? 0;

  const cacheStatus = u.cache_creation_input_tokens
    ? `[cache WRITE: ${u.cache_creation_input_tokens} tok]`
    : u.cache_read_input_tokens
      ? `[cache READ: ${u.cache_read_input_tokens} tok ✓]`
      : "";
  if (cacheStatus) process.stdout.write(`    ${cacheStatus}\n`);

  let text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim();

  if (params.jsonMode) {
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    if (!text.startsWith("{") && !text.startsWith("["))
      throw new Error(`No JSON returned: ${text.slice(0, 200)}`);
  }
  return text;
}

function loadChapterText(slug: string): string {
  const p = path.join(__dirname, "chapter-sources", `${slug}.txt`);
  if (!fs.existsSync(p)) throw new Error(`Archivo no encontrado: ${p}`);
  return fs.readFileSync(p, "utf-8");
}

function loadChapterImages(slug: string): string[] {
  const dir = path.join(__dirname, "chapter-assets", slug);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .map((f) => path.join(dir, f));
}

/**
 * Copies chapter images to Next.js public/ with clean names (fig-1.jpg, fig-2.jpg…)
 * and returns their public URL paths. Deduplicates identical images by file size.
 */
function publishImages(slug: string, rawPaths: string[]): string[] {
  if (rawPaths.length === 0) return [];
  const outDir = path.join(__dirname, "../public/chapter-images", slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Deduplicate by file size (identical images from PDF split across pages)
  const seen = new Set<number>();
  const unique: string[] = [];
  for (const p of rawPaths) {
    const size = fs.statSync(p).size;
    if (!seen.has(size)) { seen.add(size); unique.push(p); }
  }

  return unique.map((src, i) => {
    const ext = path.extname(src).toLowerCase();
    const dest = path.join(outDir, `fig-${i + 1}${ext}`);
    fs.copyFileSync(src, dest);
    return `/chapter-images/${slug}/fig-${i + 1}${ext}`;
  });
}

type ContentBlock = Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam | Anthropic.ImageBlockParam;

// Precede cada imagen con su ruta pública exacta, para que el modelo sepa qué
// archivo es cuál y use el ![](fig-N) correcto (sin esto repite fig-1 con muchas imágenes).
function buildImageBlocks(imagePaths: string[], slug: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const p of imagePaths) {
    const data = fs.readFileSync(p).toString("base64");
    const mediaType = p.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const url = `/chapter-images/${slug}/${path.basename(p)}`;
    blocks.push({ type: "text", text: `Figura ${url} (si la insertás, usá exactamente esta ruta):` });
    blocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
  }
  return blocks;
}

function printCostReport() {
  // Sonnet pricing: write $3.75/MTok, read $0.30/MTok, input $3.00/MTok, output $15.00/MTok
  // Haiku  pricing: write $1.00/MTok, read $0.08/MTok, input $0.80/MTok, output $4.00/MTok
  // We use a blended estimate (most calls are Sonnet)
  const writeRate  = 3.75 / 1_000_000;
  const readRate   = 0.30 / 1_000_000;
  const inputRate  = 3.00 / 1_000_000;
  const outputRate = 15.00 / 1_000_000;
  const total =
    usage.cacheWrite * writeRate +
    usage.cacheRead  * readRate  +
    usage.input      * inputRate +
    usage.output     * outputRate;

  const nocacheTotal =
    (usage.cacheWrite + usage.cacheRead + usage.input) * inputRate +
    usage.output * outputRate;

  console.log("\n────────────────────────────────────────");
  console.log("  Tokens cache_write : " + usage.cacheWrite.toLocaleString());
  console.log("  Tokens cache_read  : " + usage.cacheRead.toLocaleString());
  console.log("  Tokens input (new) : " + usage.input.toLocaleString());
  console.log("  Tokens output      : " + usage.output.toLocaleString());
  console.log(`  Costo estimado     : $${total.toFixed(4)}`);
  console.log(`  Sin caching sería  : $${nocacheTotal.toFixed(4)}`);
  console.log(`  Ahorro             : $${(nocacheTotal - total).toFixed(4)} (${Math.round((1 - total / nocacheTotal) * 100)}%)`);
  console.log("────────────────────────────────────────");
}

// ── Generators ───────────────────────────────────────────────────────────────

async function generateSummary(topic: any, chapterText: string, imagePaths: string[], publicUrls: string[]) {
  const snap = await db.collection("summaries").doc(SLUG!).get();
  if (snap.exists && !FORCE) { console.log("  – [summary] ya existe (--force para regenerar)"); return; }

  const imageNote = publicUrls.length > 0
    ? `\nEl capítulo incluye ${publicUrls.length} imagen(es) adjunta(s). Cada imagen viene precedida por su ruta exacta (ej. "Figura /chapter-images/.../fig-7.png"). Inserta cada figura en la sección más apropiada usando EXACTAMENTE su ruta: ![Descripción breve](esa-ruta). NUNCA repitas la misma ruta para imágenes distintas — cada figura tiene su propio archivo fig-N. Si una figura no aporta a ninguna sección, omítela.\n`
    : "";

  const taskPrompt = `Genera un resumen de estudio sobre "${topic.name}" para el examen de admisión de fisiatría (CENDEISSS segunda etapa). Basate ÚNICAMENTE en el texto del capítulo adjunto.${imageNote}

REGLA DE CONTEXTO (la más importante):
El resumen es para APRENDER, no solo para repasar datos sueltos. Quien lo lee NO conoce el concepto de antemano. Por eso, CADA herramienta, escala, signo, maniobra, índice o concepto debe presentarse con una frase breve que explique QUÉ ES y PARA QUÉ SIRVE, ANTES de listar sus valores, puntos o pasos. Nunca pongas una etiqueta seguida de cifras crudas.
- MAL: "**Plomada** — Desfase frontal: cresta sacra medial → distancia en C7"
- BIEN: "**Plomada**: hilo con peso que cuelga vertical; sirve para valorar la alineación de la columna en los planos frontal y sagital. *Desfase frontal:* se coloca sobre la cresta sacra medial y se mide la distancia hasta C7. *Perfil sagital:* la distancia se mide en las apófisis espinosas de C7 y L3 respecto al punto más sobresaliente de la cifosis."
- MAL: "**Escala TRACE** — Hombros 0–3, Escápulas 0–2..."
- BIEN: "**Escala TRACE** (Trunk Aesthetic Clinical Evaluation): valoración clínica objetiva de la asimetría estética del tronco. Suma 4 subescalas (hombros 0–3, escápulas 0–2, hemitórax 0–2, cintura 0–4) en una escala ordinal de asimetría creciente."

INCLUYE (con el contexto de la regla anterior):
- Cifras, valores de corte, porcentajes y datos numéricos concretos del capítulo — siempre acompañados de qué miden
- Clasificaciones con criterios y diferenciadores explícitos entre subtipos
- Criterios diagnósticos exactos (con sensibilidad/especificidad si aparecen en el capítulo)
- Tratamientos con sus indicaciones y contraindicaciones; dosis cuando aparezcan (rango, vía, frecuencia)
- Escalas: qué evalúan, sus ítems, puntos de corte exactos y qué decisión clínica determina cada punto
- Complicaciones con sus umbrales de alarma
- Tablas y clasificaciones del capítulo → conviértelas a tabla Markdown o bullets estructurados

FIDELIDAD AL CAPÍTULO:
- Usá SOLO lo que está en el capítulo. No agregues datos externos.
- No omitas componentes: si una escala tiene subescalas o una clasificación tiene tipos, explícalos TODOS.
- No dejes nada "a medias": si mencionás un valor o un índice, debe quedar claro qué mide y cómo se obtiene.

EXCLUYE:
- Fechas de guías, nombres de workshops o sociedades (salvo que sea dato de examen en sí)
- Códigos CIE-10
- Definiciones copiadas textualmente — reescribilas con tus palabras de forma clara y COMPLETA (qué es + componentes), nunca reducidas a una etiqueta
- Frases de relleno vacías o motivacionales (pero SÍ incluí la frase que da contexto a cada concepto)
- Repetición: cada dato aparece una sola vez en todo el resumen
- Sección final de "puntos de alto rendimiento" — no repitas el cuerpo del resumen al final
- Atribución de fuente párrafo por párrafo (el capítulo ya es la fuente)

FORMATO:
- Encabezado del resumen: si el capítulo tiene sinónimo(s), inclúyelos en una línea justo debajo del título: **Sinónimo:** X
- Si hay imágenes adjuntas, insértalas en la sección más apropiada con su pie de figura: ![Descripción breve](url)
- Bullets claros, no prosa larga: un bullet puede tener una frase de contexto + los datos. Preferí un bullet de dos oraciones que se entienda solo, antes que uno telegráfico que no.
- **Negrita** solo en el concepto clave de cada bullet (no en toda la oración)
- Cuando haya subtipos o entidades similares, etiqueta explícitamente el diferenciador: "vs." o "diferenciador:"

SECCIONES: sigue exactamente la estructura de secciones del capítulo — una sección del resumen por cada sección/título del capítulo. No inventes secciones que no estén en el capítulo ni omitas ninguna que sí esté. Si el capítulo tiene Definición, Prevalencia, Etiología, Clasificación, Síntomas, Exploración física, Diagnóstico, Tratamiento, Complicaciones, etc., todas deben aparecer en el resumen.
La única excepción: fusiona subsecciones muy cortas y relacionadas si el resultado queda más claro.

Solo devuelve el markdown, sin preámbulo.`;

  const contentMd = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    imageBlocks: buildImageBlocks(imagePaths, SLUG!),
    maxTokens: 16000,
  });

  await db.collection("summaries").doc(SLUG!).set({
    topicSlug: SLUG, contentMd, model: SONNET,
    promptV: "pdf-v2", createdAt: new Date().toISOString(),
  });
  console.log("  ✓ [summary]");
}

async function generateQuestions(topic: any, chapterText: string, imagePaths: string[], publicUrls: string[]) {
  const existing = await db.collection("questions").where("topicSlug", "==", SLUG).get();
  if (!existing.empty && !FORCE) { console.log("  – [questions] ya existen (--force para regenerar)"); return; }
  if (!existing.empty) {
    const del = db.batch();
    existing.docs.forEach((d) => del.delete(d.ref));
    await del.commit();
  }

  const imageNote = publicUrls.length > 0
    ? `\nSe adjuntan ${publicUrls.length} imagen(es). Genera AL MENOS 2 preguntas cuyo stem empiece con "En la imagen se observa..." tal como aparece en exámenes con imágenes.\n`
    : "";

  const taskPrompt = `Genera ${QUESTIONS_PER_TOPIC} preguntas MCQ sobre "${topic.name}" basándote en el texto del capítulo anterior.${imageNote}

- Viñeta clínica realista cuando sea posible.
- 5 opciones (A-E). Una sola correcta. Distractores plausibles.
- Explicación de 2-3 oraciones por opción.
- Dificultad 1-5 (apunta a 3-4).
- Cubre los puntos de alto rendimiento del capítulo.
- IMPORTANTE: distribuí la respuesta correcta de forma variada entre A, B, C, D y E. No pongas la respuesta siempre en la misma letra.

JSON exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."},{"letter":"E","text":"..."}],
      "correct": "A",
      "explanations": {"A":"Correcto. ...","B":"Incorrecto. ...","C":"Incorrecto. ...","D":"Incorrecto. ...","E":"Incorrecto. ..."},
      "difficulty": 3
    }
  ]
}`;

  const raw = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    imageBlocks: buildImageBlocks(imagePaths, SLUG!),
    maxTokens: 8000,
    jsonMode: true,
  });

  const { questions } = JSON.parse(raw);
  const imageUrl = publicUrls.length > 0 ? publicUrls[0] : null;

  const batch = db.batch();
  for (const q of questions) {
    const hasImageRef = /imagen|figura/i.test(q.stem);
    batch.set(db.collection("questions").doc(), {
      topicSlug: SLUG, stem: q.stem, options: q.options, correct: q.correct,
      explanations: q.explanations, difficulty: q.difficulty,
      imageUrl: hasImageRef ? imageUrl : null,
      model: SONNET, promptV: "pdf-v1", createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
  console.log(`  ✓ [questions] ${questions.length} preguntas`);
}

async function generateFlashcards(topic: any, chapterText: string, imagePaths: string[], publicUrls: string[]) {
  const existing = await db.collection("flashcards").where("topicSlug", "==", SLUG).get();
  if (!existing.empty && !FORCE) { console.log("  – [flashcards] ya existen (--force para regenerar)"); return; }
  if (!existing.empty) {
    const del = db.batch();
    existing.docs.forEach((d) => {
      del.delete(d.ref);
      del.delete(db.collection("flashcardReviews").doc(d.id));
    });
    await del.commit();
  }

  const imageUrl = publicUrls.length > 0 ? publicUrls[0] : null;

  const taskPrompt = `Genera ${CARDS_PER_TOPIC} flashcards sobre "${topic.name}" basándote en el texto del capítulo anterior.

Reglas Anki:
- Una idea atómica por tarjeta.
- Frente: pregunta o frase incompleta concisa.
- Dorso: respuesta directa con números/criterios exactos cuando apliquen.
- Tags: 1-3 palabras clave kebab-case sin tildes.
- Cubre los puntos de alto rendimiento del capítulo.
${imageUrl ? `- Para 2-3 tarjetas que muestren la figura del capítulo, usa "imageUrl": "${imageUrl}" y frente como "¿Qué técnica/estructura se muestra en esta imagen?".` : ""}

JSON:
{
  "cards": [
    { "front": "...", "back": "...", "tags": ["tag1","tag2"], "imageUrl": null }
  ]
}`;

  const raw = await callCached({
    model: HAIKU,
    chapterText,
    taskPrompt,
    maxTokens: 8000,
    jsonMode: true,
  });

  const { cards } = JSON.parse(raw);
  const batch = db.batch();
  for (const c of cards) {
    const cardRef = db.collection("flashcards").doc();
    const cardImageUrl = c.imageUrl ?? null;
    batch.set(cardRef, {
      topicSlug: SLUG, front: c.front, back: c.back, tags: c.tags ?? [],
      imageUrl: cardImageUrl,
      model: HAIKU, promptV: "pdf-v1", createdAt: Timestamp.now(),
    });
    batch.set(db.collection("flashcardReviews").doc(cardRef.id), {
      flashcardId: cardRef.id, topicSlug: SLUG, topicName: topic.name,
      front: c.front, back: c.back, tags: c.tags ?? [],
      imageUrl: cardImageUrl,
      repetitions: 0, easeFactor: 2.5, intervalDays: 0,
      dueAt: Timestamp.now(), lastReviewed: null, lastQuality: null,
    });
  }
  await batch.commit();
  await db.collection("topicStats").doc(SLUG!).set(
    { totalCards: cards.length, matureCards: 0, mcqAttempts: 0, mcqCorrect: 0, mastery: 0 },
    { merge: true }
  );
  console.log(`  ✓ [flashcards] ${cards.length} tarjetas`);
}

async function generateExamQuestions(topic: any, chapterText: string, imagePaths: string[], publicUrls: string[]) {
  const existing = await db.collection("examQuestions").where("topicSlug", "==", SLUG).get();
  if (!existing.empty && !FORCE) { console.log("  – [exam-questions] ya existen (--force para regenerar)"); return; }
  if (!existing.empty) {
    const del = db.batch();
    existing.docs.forEach((d) => del.delete(d.ref));
    await del.commit();
  }

  const imageNote = publicUrls.length > 0
    ? `\nSe adjuntan imágenes. Genera AL MENOS 1 pregunta cuyo stem empiece con "En la imagen se observa...".`
    : "";

  const taskPrompt = `Genera ${EXAM_QUESTIONS_PER_TOPIC} preguntas de examen sobre "${topic.name}" basándote en el texto del capítulo anterior.${imageNote}

- Viñeta clínica realista. EXACTAMENTE 6 opciones (A-F). Una sola correcta.
- Distractores plausibles. Explicación por opción (2-4 oraciones). Dificultad 3-4.
- IMPORTANTE: distribuí la respuesta correcta de forma variada entre A, B, C, D, E y F. No pongas la respuesta siempre en la misma letra.

JSON exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."},{"letter":"E","text":"..."},{"letter":"F","text":"..."}],
      "correct": "B",
      "explanations": {"A":"...","B":"...","C":"...","D":"...","E":"...","F":"..."},
      "difficulty": 3,
      "imageUrl": null
    }
  ]
}`;

  const raw = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    imageBlocks: buildImageBlocks(imagePaths, SLUG!),
    maxTokens: 10000,
    jsonMode: true,
  });

  const { questions } = JSON.parse(raw);
  const imageUrl = publicUrls.length > 0 ? publicUrls[0] : null;

  const batch = db.batch();
  for (const q of questions) {
    const hasImageRef = /imagen|figura/i.test(q.stem);
    batch.set(db.collection("examQuestions").doc(), {
      topicSlug: SLUG, topicName: topic.name, topicCategory: topic.category,
      stem: q.stem, options: q.options, correct: q.correct,
      explanations: q.explanations, difficulty: q.difficulty,
      // Ignorar q.imageUrl: el modelo alucina rutas ("image1", "uploaded_image").
      // Usar solo la ruta real publicada, igual que generateQuestions.
      imageUrl: hasImageRef ? imageUrl : null,
      model: SONNET, promptV: "pdf-v1", createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
  console.log(`  ✓ [exam-questions] ${questions.length} preguntas`);
}

// ── Podcast ──────────────────────────────────────────────────────────────────

async function generatePodcast(topic: any, chapterText: string) {
  const snap = await db.collection("podcasts").doc(SLUG!).get();
  if (snap.exists && !FORCE) { console.log("  – [podcast] ya existe (--force para regenerar)"); return; }

  const taskPrompt = `Escribe un guion de podcast educativo en español (Costa Rica) basándote en el texto del capítulo anterior.

PERSONAJES:
- C: Presentadora. Habla directamente a Bele (la residente) usando "vos" (nunca "usted"). Tono cálido, motivador. SOLO ella puede decir "Bele". Aparece en intro, cierre, y cada vez que hay un concepto de alto rendimiento para el examen (lo señala con una frase corta intercalada, sin interrumpir el flujo).
- A: Dr. Marín, fisiatra académico. Explica definiciones, clasificaciones, criterios, fisiopatología. NUNCA dice "Bele".
- B: Dra. Vargas, fisiatra clínica. Conecta con la práctica: cómo se ve en el paciente, errores comunes, perlas clínicas. NUNCA dice "Bele".

ESTRUCTURA:
1. INTRO — C (1 intervención): presenta el tema, por qué importa en el examen y en la práctica clínica. Directa y motivadora.
2. DESARROLLO — A y B se alternan; C aparece brevemente cuando hay dato de alto rendimiento ("Bele, eso cae en examen" o similar): cubren el contenido completo del capítulo en orden lógico.
3. CIERRE — C (1 intervención): las 3 cosas que Bele debe poder decir de memoria el día del examen. Cierre motivador y personal.

REGLAS OBLIGATORIAS:
- Este podcast debe funcionar igual de bien para alguien que lo escucha POR PRIMERA VEZ antes de estudiar, y para alguien que lo escucha DE REPASO una semana antes del examen.
- Tono para escuchar manejando: conversacional, natural, costarricense ("uno", "vea", "fíjese", "exactamente", "claro que sí").
- NÚMEROS: NUNCA digas un porcentaje ni una cifra exacta en el audio. Siempre traduce a lenguaje auditivo natural: "cerca de uno de cada mil", "la gran mayoría", "casi la mitad", "alrededor de tres de cada cuatro", "una pequeña proporción". El oyente va manejando — un número exacto no se le va a quedar. Solo usá un número si es un hito completamente redondo e icónico (ej: "cinco niveles", "tres tipos").
- LONGITUD: 20-28 intervenciones máximo. NO intentes cubrir cada dato del capítulo — seleccioná los conceptos de mayor rendimiento para el examen: clasificaciones principales, diferenciadores entre subtipos, perlas clínicas que se confunden en examen. Los datos numéricos exactos se quedan en el resumen escrito; el podcast es para entender y recordar la lógica.
- Cada intervención: 3-5 oraciones fluidas, ritmo natural para audio.
- NUNCA mencionen ser una IA.
- SIGLAS: NUNCA uses siglas en mayúsculas (escríbelas en su forma completa). Solo usá una sigla si absolutamente no existe otra forma.
- IDIOMA: NUNCA uses palabras en inglés. Todo en español.
- FUENTE: Todo el contenido debe provenir ÚNICAMENTE del capítulo adjunto.

JSON exacto, sin markdown, sin texto adicional:
{ "script": [{ "speaker": "C", "text": "..." }, { "speaker": "A", "text": "..." }] }`;

  console.log("  … [podcast] generando guion...");
  const raw = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    maxTokens: 14000,
    jsonMode: true,
  });

  const { script } = JSON.parse(raw) as { script: { speaker: "A" | "B" | "C"; text: string }[] };

  // Save script only — audio is generated manually in ElevenLabs and uploaded via upload-podcast.ts
  await db.collection("podcasts").doc(SLUG!).set({
    topicSlug: SLUG, script, audioUrl: null,
    model: SONNET, promptV: "pdf-v2", createdAt: Timestamp.now(),
  });
  console.log(`  ✓ [podcast] guion guardado (${script.length} intervenciones)`);
  console.log(`    → Sube el audio con: npm run upload:podcast -- --slug=${SLUG} --file=/ruta/audio.mp3`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const topicSnap = await db.collection("topics").doc(SLUG!).get();
  if (!topicSnap.exists) { console.error(`Tema "${SLUG}" no encontrado en Firebase`); process.exit(1); }
  const topic = { slug: SLUG, ...topicSnap.data() } as any;

  console.log(`\n📖 ${topic.name}\n`);

  const chapterText = loadChapterText(SLUG!);
  const imagePaths  = loadChapterImages(SLUG!);
  const publicUrls  = publishImages(SLUG!, imagePaths);
  console.log(`   Texto: ${(chapterText.length / 1000).toFixed(1)}k chars | Imágenes: ${publicUrls.length}\n`);

  const run = (name: string, fn: () => Promise<void>) =>
    (!ONLY || ONLY === name) ? fn().catch((e: any) => console.error(`  ✗ [${name}]`, e.message)) : Promise.resolve();

  await run("summary",        () => generateSummary(topic, chapterText, imagePaths, publicUrls));
  await run("questions",      () => generateQuestions(topic, chapterText, imagePaths, publicUrls));
  await run("exam-questions", () => generateExamQuestions(topic, chapterText, imagePaths, publicUrls));
  await run("flashcards",     () => generateFlashcards(topic, chapterText, imagePaths, publicUrls));
  if (WITH_PODCAST) await run("podcast", () => generatePodcast(topic, chapterText));
  else console.log("  – [podcast] omitido (sin ElevenLabs; usá --podcast para generar el guión)");

  printCostReport();
  console.log("\n✅ Listo.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
