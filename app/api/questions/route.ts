import { NextResponse } from "next/server";
import { db, FieldValue, Timestamp, refreshMastery } from "@/lib/db/firebase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const n = Math.min(20, Math.max(1, Number(url.searchParams.get("n") ?? 5)));
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();

  const poolSnap = await firestore
    .collection("questions")
    .where("topicSlug", "==", slug)
    .limit(n * 3)
    .get();

  if (poolSnap.empty) {
    return NextResponse.json({ questions: [], ready: false });
  }

  const shuffled = poolSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(() => Math.random() - 0.5)
    .slice(0, n);

  return NextResponse.json({ questions: shuffled, ready: true });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { questionId: string; chosen: string; timeMs?: number };

  const firestore = db();
  const qSnap = await firestore.collection("questions").doc(body.questionId).get();
  if (!qSnap.exists) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const q = qSnap.data()!;
  const isCorrect = body.chosen === q.correct;

  await firestore.collection("questionAttempts").add({
    questionId: body.questionId,
    topicSlug: q.topicSlug,
    chosen: body.chosen,
    correct: isCorrect,
    timeMs: body.timeMs ?? null,
    createdAt: Timestamp.now(),
  });

  await firestore
    .collection("topicStats")
    .doc(q.topicSlug)
    .set(
      {
        mcqAttempts: FieldValue.increment(1),
        mcqCorrect: FieldValue.increment(isCorrect ? 1 : 0),
      },
      { merge: true },
    );

  await refreshMastery(q.topicSlug);

  return NextResponse.json({ correct: isCorrect, expected: q.correct });
}
