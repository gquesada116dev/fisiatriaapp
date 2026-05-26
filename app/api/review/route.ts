import { NextResponse } from "next/server";
import { db, Timestamp, refreshMastery } from "@/lib/db/firebase";
import { sm2, SM2_DEFAULT, type Quality } from "@/lib/sm2";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { flashcardId: string; quality: number };
  if (body.quality < 0 || body.quality > 5) {
    return NextResponse.json({ error: "quality must be 0..5" }, { status: 400 });
  }

  const firestore = db();
  const reviewRef = firestore.collection("flashcardReviews").doc(body.flashcardId);
  const snap = await reviewRef.get();
  const current = snap.data();
  const topicSlug: string = current?.topicSlug ?? "";

  const prev = current
    ? { repetitions: current.repetitions, easeFactor: current.easeFactor, intervalDays: current.intervalDays }
    : SM2_DEFAULT;

  const next = sm2(prev, body.quality as Quality);

  await reviewRef.set(
    {
      repetitions: next.repetitions,
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      dueAt: Timestamp.fromDate(next.dueAt),
      lastReviewed: Timestamp.now(),
      lastQuality: body.quality,
    },
    { merge: true },
  );

  if (topicSlug) await refreshMastery(topicSlug);

  return NextResponse.json({
    repetitions: next.repetitions,
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    dueAt: next.dueAt.toISOString(),
  });
}
