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
const CARDS_PER_TOPIC = 25;
const QUESTIONS_PER_TOPIC = 7;
const EXAM_QUESTIONS_PER_TOPIC = 5;
const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

// Running totals for cost reporting
const usage = { cacheWrite: 0, cacheRead: 0, input: 0, output: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

const SYSTEM_BASE = `Eres un médico fisiatra docente en Costa Rica, con experiencia preparando residentes para el examen de admisión de segunda etapa de Medicina Física y Rehabilitación (CENDEISSS/CCSS). Tu estilo es preciso, didáctico y enfocado en lo clínicamente relevante. Usa terminología médica estándar en español.

Bibliografía base: Manual de MFR de Frontera/Silver/Rizzo 4ª ed. (2020) y Braddom's PMR 6ª ed. (2021). El texto del capítulo que se te proporciona es la fuente primaria — basa el contenido directamente en él.`;

type CachedCallParams = {
  model: string;
  chapterText: string;
  taskPrompt: string;
  imageBlocks?: Anthropic.ImageBlockParam[];
  maxTokens: number;
  jsonMode?: boolean;
};

async function callCached(params: CachedCallParams): Promise<string> {
  // System block is IDENTICAL for all calls → cached after first write, read on all subsequent
  const systemBlocks: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
  ];

  // Chapter text is the cacheable prefix — identical across all calls for this chapter
  const chapterBlock: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam = {
    type: "text",
    text: `--- TEXTO DEL CAPÍTULO (fuente primaria) ---\n${params.chapterText}\n--- FIN DEL CAPÍTULO ---`,
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

function buildImageBlocks(imagePaths: string[]): Anthropic.ImageBlockParam[] {
  return imagePaths.map((p) => {
    const data = fs.readFileSync(p).toString("base64");
    const mediaType = p.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  });
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
    ? `\nEl capítulo incluye ${publicUrls.length} imagen(es) adjunta(s). Insértalas en la sección más apropiada como:\n![Descripción](${publicUrls[0]})\n`
    : "";

  const taskPrompt = `Genera un resumen de estudio exhaustivo sobre "${topic.name}" basándote DIRECTAMENTE en el texto del capítulo anterior.${imageNote}

Estructura en Markdown con TODAS las secciones que apliquen:
## Definición y conceptos clave
## Epidemiología y relevancia clínica
## Anatomía y fisiopatología
## Presentación clínica / Síntomas
## Evaluación y diagnóstico
## Escalas y clasificaciones validadas
## Objetivos de rehabilitación
## Intervenciones en fisiatría
## Manejo farmacológico adyuvante
## Complicaciones y banderas rojas
## Puntos de alto rendimiento para el examen

Requisitos: nivel de residente de segundo año. Tablas del capítulo en Markdown. ~2500 palabras. Solo devuelve el markdown.`;

  const contentMd = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    imageBlocks: buildImageBlocks(imagePaths),
    maxTokens: 8000,
  });

  await db.collection("summaries").doc(SLUG!).set({
    topicSlug: SLUG, contentMd, model: SONNET,
    promptV: "pdf-v1", createdAt: new Date().toISOString(),
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

JSON exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."},{"letter":"E","text":"..."}],
      "correct": "C",
      "explanations": {"A":"Incorrecto. ...","B":"Incorrecto. ...","C":"Correcto. ...","D":"Incorrecto. ...","E":"Incorrecto. ..."},
      "difficulty": 3
    }
  ]
}`;

  const raw = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    imageBlocks: buildImageBlocks(imagePaths),
    maxTokens: 6000,
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

JSON exacto:
{
  "questions": [
    {
      "stem": "...",
      "options": [{"letter":"A","text":"..."},{"letter":"B","text":"..."},{"letter":"C","text":"..."},{"letter":"D","text":"..."},{"letter":"E","text":"..."},{"letter":"F","text":"..."}],
      "correct": "C",
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
    imageBlocks: buildImageBlocks(imagePaths),
    maxTokens: 6000,
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
      imageUrl: q.imageUrl ?? (hasImageRef ? imageUrl : null),
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

  const taskPrompt = `Escribe un guion de podcast educativo en español (Costa Rica) entre dos médicos fisiatras conversando sobre "${topic.name}", basándote en el texto del capítulo anterior.

Personajes:
- A: Dra. Vargas, fisiatra con experiencia clínica. Pregunta, problematiza, da ejemplos de casos.
- B: Dr. Marín, fisiatra académico. Estructura, da datos, criterios y números.

Estilo:
- Conversación natural costarricense, NO formal. Pueden usar "uno", "vea", "fíjese".
- Sin saludos extensos. Empiezan ya en el tema.
- 12-20 intervenciones, alternando A/B. Cada intervención: 2-5 oraciones.
- Cubre: concepto clave, evaluación, manejo, un error frecuente. Cierra con un take-home claro.
- NUNCA mencionen ser una IA.

JSON exacto:
{
  "script": [
    { "speaker": "A", "text": "..." },
    { "speaker": "B", "text": "..." }
  ]
}`;

  console.log("  … [podcast] generando guion...");
  const raw = await callCached({
    model: SONNET,
    chapterText,
    taskPrompt,
    maxTokens: 6000,
    jsonMode: true,
  });

  const { script } = JSON.parse(raw) as { script: { speaker: "A" | "B"; text: string }[] };
  console.log(`  … [podcast] guion listo (${script.length} intervenciones) — sintetizando audio...`);

  const { synthesizePodcast } = await import("../lib/audio/elevenlabs");
  const { storageDownloadUrl } = await import("../lib/db/firebase");
  const { getStorage } = await import("firebase-admin/storage");

  const voiceA = process.env.ELEVENLABS_VOICE_HOST_A!;
  const voiceB = process.env.ELEVENLABS_VOICE_HOST_B!;
  const mp3 = await synthesizePodcast(script, { a: voiceA, b: voiceB });

  const audioPath = `${SLUG}/${Date.now()}.mp3`;
  const downloadToken = crypto.randomUUID();
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET!);
  await bucket.file(audioPath).save(mp3, {
    metadata: { contentType: "audio/mpeg", metadata: { firebaseStorageDownloadTokens: downloadToken } },
  });
  const audioUrl = storageDownloadUrl(bucket.name, audioPath, downloadToken);

  await db.collection("podcasts").doc(SLUG!).set({
    topicSlug: SLUG, script, audioPath, audioUrl,
    voiceA, voiceB, model: SONNET,
    promptV: "pdf-v1", createdAt: Timestamp.now(),
  });
  console.log("  ✓ [podcast]");
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

  try { await generateSummary(topic, chapterText, imagePaths, publicUrls);       } catch (e: any) { console.error("  ✗ [summary]", e.message); }
  try { await generateQuestions(topic, chapterText, imagePaths, publicUrls);     } catch (e: any) { console.error("  ✗ [questions]", e.message); }
  try { await generateExamQuestions(topic, chapterText, imagePaths, publicUrls); } catch (e: any) { console.error("  ✗ [exam-questions]", e.message); }
  try { await generateFlashcards(topic, chapterText, imagePaths, publicUrls);    } catch (e: any) { console.error("  ✗ [flashcards]", e.message); }
  try { await generatePodcast(topic, chapterText);                                } catch (e: any) { console.error("  ✗ [podcast]", e.message); }

  printCostReport();
  console.log("\n✅ Listo.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
