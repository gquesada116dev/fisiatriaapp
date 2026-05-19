import { NextResponse } from "next/server";
import { db, FieldValue, Timestamp, refreshMastery } from "@/lib/db/firebase";
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

  const prev = current
    ? { repetitions: current.repetitions, easeFactor: current.easeFactor, intervalDays: current.intervalDays }
    : SM2_DEFAULT;

  const next = sm2(prev, body.quality as Quality);

  const wasMature = (current?.intervalDays ?? 0) >= 21;
  const isMature = next.intervalDays >= 21;
  const topicSlug: string = current?.topicSlug ?? "";

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

  await firestore.collection("flashcardReviewLog").add({
    flashcardId: body.flashcardId,
    topicSlug,
    quality: body.quality,
    prevInterval: prev.intervalDays,
    nextInterval: next.intervalDays,
    reviewedAt: Timestamp.now(),
  });

  if (topicSlug && wasMature !== isMature) {
    await firestore
      .collection("topicStats")
      .doc(topicSlug)
      .set({ matureCards: FieldValue.increment(isMature ? 1 : -1) }, { merge: true });
    await refreshMastery(topicSlug);
  }

  return NextResponse.json({
    repetitions: next.repetitions,
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    dueAt: next.dueAt.toISOString(),
  });
}
