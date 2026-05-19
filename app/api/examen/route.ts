import { NextResponse } from "next/server";
import { db, Timestamp } from "@/lib/db/firebase";
import { generateJson } from "@/lib/ai/client";
import { examQuestionsPrompt, type GeneratedExamQuestion } from "@/lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS, PROMPT_VERSIONS } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const POOL_PER_TOPIC = 10;
const MIN_POOL = 5; // generate more when pool drops below this

/** GET /api/examen?n=10  — returns n random exam questions from global pool */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.min(20, Math.max(1, Number(url.searchParams.get("n") ?? 10)));
  const firestore = db();

  // Count total exam questions.
  const totalSnap = await firestore.collection("examQuestions").count().get();
  const total = totalSnap.data().count;

  // If pool is too thin, generate for a topic that doesn't have exam questions yet.
  if (total < MIN_POOL) {
    const topicsSnap = await firestore.collection("topics").get();
    const allSlugs = topicsSnap.docs.map((d) => d.id);

    // Find a topic with no exam questions.
    const coveredSnap = await firestore
      .collection("examQuestions")
      .select("topicSlug")
      .get();
    const coveredSlugs = new Set(coveredSnap.docs.map((d) => d.data().topicSlug));
    const uncovered = allSlugs.filter((s) => !coveredSlugs.has(s));

    const targetSlug =
      uncovered.length > 0
        ? uncovered[Math.floor(Math.random() * uncovered.length)]
        : allSlugs[Math.floor(Math.random() * allSlugs.length)];

    await generateForTopic(targetSlug, firestore);
  }

  // Fetch a larger pool and shuffle client-side to get n random questions.
  const poolSnap = await firestore
    .collection("examQuestions")
    .limit(n * 4)
    .get();

  const shuffled = poolSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(() => Math.random() - 0.5)
    .slice(0, n);

  return NextResponse.json({ questions: shuffled });
}

/** POST /api/examen  — record an attempt */
export async function POST(req: Request) {
  const body = (await req.json()) as { questionId: string; chosen: string; timeMs?: number };
  const firestore = db();

  const qSnap = await firestore.collection("examQuestions").doc(body.questionId).get();
  if (!qSnap.exists) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const q = qSnap.data()!;
  const isCorrect = body.chosen === q.correct;

  await firestore.collection("examAttempts").add({
    questionId: body.questionId,
    topicSlug: q.topicSlug,
    chosen: body.chosen,
    correct: isCorrect,
    timeMs: body.timeMs ?? null,
    createdAt: Timestamp.now(),
  });

  return NextResponse.json({ correct: isCorrect, expected: q.correct });
}

async function generateForTopic(slug: string, firestore: ReturnType<typeof db>) {
  const topicSnap = await firestore.collection("topics").doc(slug).get();
  if (!topicSnap.exists) return;
  const topic = { slug, ...topicSnap.data() } as any;

  const { questions } = await generateJson<{ questions: GeneratedExamQuestion[] }>({
    model: AI_MODELS.examQuestions,
    system: examQuestionsPrompt(topic, POOL_PER_TOPIC).system,
    prompt: examQuestionsPrompt(topic, POOL_PER_TOPIC).user,
    maxTokens: MAX_TOKENS.examQuestions,
  });

  const batch = firestore.batch();
  for (const q of questions) {
    const ref = firestore.collection("examQuestions").doc();
    batch.set(ref, {
      topicSlug: slug,
      topicName: topic.name,
      topicCategory: topic.category,
      stem: q.stem,
      options: q.options,
      correct: q.correct,
      explanations: q.explanations,
      difficulty: q.difficulty,
      model: AI_MODELS.examQuestions,
      promptV: PROMPT_VERSIONS.examQuestions,
      createdAt: Timestamp.now(),
    });
  }
  await batch.commit();
}
