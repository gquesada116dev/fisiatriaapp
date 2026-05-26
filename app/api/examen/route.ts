import { NextResponse } from "next/server";
import { db, Timestamp } from "@/lib/db/firebase";

export const runtime = "nodejs";

/** GET /api/examen?n=10  — returns n random exam questions from pre-generated pool */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.min(20, Math.max(1, Number(url.searchParams.get("n") ?? 10)));
  const firestore = db();

  const poolSnap = await firestore.collection("examQuestions").limit(n * 4).get();

  if (poolSnap.empty) {
    return NextResponse.json({ questions: [], empty: true });
  }

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
