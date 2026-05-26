/**
 * Pre-generates all content for every topic and saves it to Firebase.
 * Run locally — no Vercel timeout limits.
 *
 * Usage:
 *   npm run generate:all            — summaries + flashcards + questions + exam questions
 *   npm run generate:all -- --podcasts  — también genera podcasts (lento y caro)
 *
 * Safe to re-run: skips content that already existe en Firebase.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  summaryPrompt,
  flashcardsPrompt,
  questionsPrompt,
  examQuestionsPrompt,
  podcastPrompt,
  topicImageDallePrompt,
  type GeneratedFlashcard,
  type GeneratedQuestion,
  type GeneratedExamQuestion,
  type PodcastLine,
} from "../lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS, PROMPT_VERSIONS } from "../lib/ai/config";

// ── Init ────────────────────────────────────────────────────────────────────

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

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set — add it to .env.local to generate images");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const WITH_PODCASTS = process.argv.includes("--podcasts");
const CATEGORY_FILTER = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];
const CARDS_PER_TOPIC = 25;
const QUESTIONS_PER_TOPIC = 7;
const EXAM_QUESTIONS_PER_TOPIC = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Cache the system prompt across all calls in this batch run.
// Minimum 1024 tokens required — system + JSON instruction clears that easily.
async function generateJson<T>(args: { model: string; system: string; prompt: string; maxTokens: number }): Promise<T> {
  const systemBlock: Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam = {
    type: "text",
    text: args.system + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no preamble.",
    cache_control: { type: "ephemeral" },
  };
  const resp = await ai.beta.promptCaching.messages.create({
    model: args.model,
    max_tokens: args.maxTokens,
    system: [systemBlock],
    messages: [{ role: "user", content: args.prompt }],
  });
  let text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "");
  if (!text.startsWith("{") && !text.startsWith("[")) {
    throw new Error(`API did not return JSON. Response: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

function log(topic: string, step: string, status: "skip" | "ok" | "err", detail?: string) {
  const icon = status === "skip" ? "–" : status === "ok" ? "✓" : "✗";
  console.log(`  ${icon} [${step}] ${topic}${detail ? ` — ${detail}` : ""}`);
}

// ── Generators ───────────────────────────────────────────────────────────────

async function generateSummary(topic: any) {
  const snap = await db.collection("summaries").doc(topic.slug).get();
  if (snap.exists && snap.data()?.promptV === PROMPT_VERSIONS.summary) {
    log(topic.name, "summary", "skip"); return;
  }
  const { system, user } = summaryPrompt(topic);
  const resp = await ai.beta.promptCaching.messages.create({
    model: AI_MODELS.summary,
    max_tokens: MAX_TOKENS.summary,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const content_md = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  await db.collection("summaries").doc(topic.slug).set({
    topicSlug: topic.slug, contentMd: content_md, model: AI_MODELS.summary,
    promptV: PROMPT_VERSIONS.summary, createdAt: new Date().toISOString(),
  });
  log(topic.name, "summary", "ok");
}

async function generateFlashcards(topic: any) {
  const existing = await db.collection("flashcards").where("topicSlug", "==", topic.slug).limit(1).get();
  if (!existing.empty) { log(topic.name, "flashcards", "skip"); return; }

  const { cards } = await generateJson<{ cards: GeneratedFlashcard[] }>({
    model: AI_MODELS.flashcards,
    system: flashcardsPrompt(topic, CARDS_PER_TOPIC).system,
    prompt: flashcardsPrompt(topic, CARDS_PER_TOPIC).user,
    maxTokens: MAX_TOKENS.flashcards,
  });

  const batch = db.batch();
  for (const c of cards) {
    const cardRef = db.collection("flashcards").doc();
    batch.set(cardRef, {
      topicSlug: topic.slug, front: c.front, back: c.back, tags: c.tags ?? [],
      model: AI_MODELS.flashcards, promptV: PROMPT_VERSIONS.flashcards, createdAt: Timestamp.now(),
    });
    batch.set(db.collection("flashcardReviews").doc(cardRef.id), {
      flashcardId: cardRef.id, topicSlug: topic.slug, topicName: topic.name,
      front: c.front, back: c.back, tags: c.tags ?? [],
      repetitions: 0, easeFactor: 2.5, intervalDays: 0,
      dueAt: Timestamp.now(), lastReviewed: null, lastQuality: null,
    });
  }
  await batch.commit();
  await db.collection("topicStats").doc(topic.slug).set(
    { totalCards: cards.length, matureCards: 0, mcqAttempts: 0, mcqCorrect: 0, mastery: 0 },
    { merge: true },
  );
  log(topic.name, "flashcards", "ok", `${cards.length} tarjetas`);
}

async function generateQuestions(topic: any) {
  const existing = await db.collection("questions").where("topicSlug", "==", topic.slug).where("promptV", "==", PROMPT_VERSIONS.questions).count().get();
  if (existing.data().count >= QUESTIONS_PER_TOPIC) { log(topic.name, "questions", "skip"); return; }
  // Delete old version questions before regenerating
  const old = await db.collection("questions").where("topicSlug", "==", topic.slug).get();
  if (!old.empty) {
    const delBatch = db.batch();
    old.docs.forEach((d) => delBatch.delete(d.ref));
    await delBatch.commit();
  }
  const needed = QUESTIONS_PER_TOPIC;

  const { questions } = await generateJson<{ questions: GeneratedQuestion[] }>({
    model: AI_MODELS.questions,
    system: questionsPrompt(topic, needed).system,
    prompt: questionsPrompt(topic, needed).user,
    maxTokens: MAX_TOKENS.questions,
  });

  const batch = db.batch();
  for (const q of questions) {
    batch.set(db.collection("questions").doc(), {
      topicSlug: topic.slug, stem: q.stem, options: q.options, correct: q.correct,
      explanations: q.explanations, difficulty: q.difficulty,
      model: AI_MODELS.questions, promptV: PROMPT_VERSIONS.questions, createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
  log(topic.name, "questions", "ok", `${questions.length} preguntas`);
}

async function generateExamQuestions(topic: any) {
  const countSnap = await db.collection("examQuestions").where("topicSlug", "==", topic.slug).count().get();
  if (countSnap.data().count >= EXAM_QUESTIONS_PER_TOPIC) { log(topic.name, "exam-questions", "skip"); return; }

  const needed = EXAM_QUESTIONS_PER_TOPIC - countSnap.data().count;
  const { questions } = await generateJson<{ questions: GeneratedExamQuestion[] }>({
    model: AI_MODELS.examQuestions,
    system: examQuestionsPrompt(topic, needed).system,
    prompt: examQuestionsPrompt(topic, needed).user,
    maxTokens: MAX_TOKENS.examQuestions,
  });

  const batch = db.batch();
  for (const q of questions) {
    batch.set(db.collection("examQuestions").doc(), {
      topicSlug: topic.slug, topicName: topic.name, topicCategory: topic.category,
      stem: q.stem, options: q.options, correct: q.correct, explanations: q.explanations,
      difficulty: q.difficulty, model: AI_MODELS.examQuestions,
      promptV: PROMPT_VERSIONS.examQuestions, createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
  log(topic.name, "exam-questions", "ok", `${questions.length} preguntas`);
}

async function generateImage(topic: any) {
  const topicSnap = await db.collection("topics").doc(topic.slug).get();
  if (topicSnap.data()?.imageUrl) { log(topic.name, "image", "skip"); return; }

  const prompt = topicImageDallePrompt(topic);
  const response = await getOpenAI().images.generate({
    model: "dall-e-2",
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const tempUrl = response.data![0].url!;
  const imgResp = await fetch(tempUrl);
  const buffer = Buffer.from(await imgResp.arrayBuffer());

  const { getStorage } = await import("firebase-admin/storage");
  const imagePath = `topic-images/${topic.slug}.png`;
  const downloadToken = crypto.randomUUID();
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET!);
  await bucket.file(imagePath).save(buffer, {
    metadata: { contentType: "image/png", metadata: { firebaseStorageDownloadTokens: downloadToken } },
  });

  const { storageDownloadUrl } = await import("../lib/db/firebase");
  const firebaseUrl = storageDownloadUrl(bucket.name, imagePath, downloadToken);
  await db.collection("topics").doc(topic.slug).update({ imageUrl: firebaseUrl });
  log(topic.name, "image", "ok");
}

async function generatePodcast(topic: any) {
  const snap = await db.collection("podcasts").doc(topic.slug).get();
  if (snap.exists) { log(topic.name, "podcast", "skip"); return; }

  const { synthesizePodcast } = await import("../lib/audio/elevenlabs");
  const { storageDownloadUrl } = await import("../lib/db/firebase");
  const { getStorage } = await import("firebase-admin/storage");

  const { system, user } = podcastPrompt(topic);
  const { script } = await generateJson<{ script: PodcastLine[] }>({
    model: AI_MODELS.podcastScript, system, prompt: user, maxTokens: MAX_TOKENS.podcastScript,
  });

  const voiceA = process.env.ELEVENLABS_VOICE_HOST_A!;
  const voiceB = process.env.ELEVENLABS_VOICE_HOST_B!;
  const mp3 = await synthesizePodcast(script, { a: voiceA, b: voiceB });

  const audioPath = `${topic.slug}/${Date.now()}.mp3`;
  const downloadToken = crypto.randomUUID();
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET!);
  await bucket.file(audioPath).save(mp3, {
    metadata: { contentType: "audio/mpeg", metadata: { firebaseStorageDownloadTokens: downloadToken } },
  });
  const audioUrl = storageDownloadUrl(bucket.name, audioPath, downloadToken);

  await db.collection("podcasts").doc(topic.slug).set({
    topicSlug: topic.slug, script, audioPath, audioUrl,
    voiceA, voiceB, model: AI_MODELS.podcastScript,
    promptV: PROMPT_VERSIONS.podcastScript, createdAt: Timestamp.now(),
  });
  log(topic.name, "podcast", "ok");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const topicsSnap = await db.collection("topics").orderBy("sortOrder").get();
  let topics = topicsSnap.docs.map((d) => ({ slug: d.id, ...d.data() })) as any[];
  if (CATEGORY_FILTER) {
    topics = topics.filter((t) => t.category === CATEGORY_FILTER);
  }
  console.log(`\nGenerando contenido para ${topics.length} temas${CATEGORY_FILTER ? ` (${CATEGORY_FILTER})` : ""}...\n`);
  if (WITH_PODCASTS) console.log("⚠️  Modo podcasts activado — esto puede tardar bastante.\n");

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i] as any;
    console.log(`[${i + 1}/${topics.length}] ${topic.name}`);
    try { await generateImage(topic); } catch (e: any) { log(topic.name, "image", "err", e.message); }
    try { await generateSummary(topic); } catch (e: any) { log(topic.name, "summary", "err", e.message); }
    try { await generateFlashcards(topic); } catch (e: any) { log(topic.name, "flashcards", "err", e.message); }
    try { await generateQuestions(topic); } catch (e: any) { log(topic.name, "questions", "err", e.message); }
    try { await generateExamQuestions(topic); } catch (e: any) { log(topic.name, "exam-questions", "err", e.message); }
    if (WITH_PODCASTS) {
      try { await generatePodcast(topic); } catch (e: any) { log(topic.name, "podcast", "err", e.message); }
    }
    console.log("");
  }

  console.log("✅ Listo.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
