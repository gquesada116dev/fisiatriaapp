import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();

  const deckSnap = await firestore.collection("flashcards").where("topicSlug", "==", slug).get();
  const reviewSnap = await firestore
    .collection("flashcardReviews")
    .where("topicSlug", "==", slug)
    .get();
  const reviewMap = new Map(reviewSnap.docs.map((d) => [d.id, d.data()]));

  const cards = deckSnap.docs.map((d) => {
    const data = d.data();
    const rev = reviewMap.get(d.id);
    return {
      id: d.id,
      front: data.front,
      back: data.back,
      tags: data.tags,
      imageUrl: data.imageUrl ?? null,
      review: rev
        ? {
            repetitions: rev.repetitions,
            ease_factor: rev.easeFactor,
            interval_days: rev.intervalDays,
            due_at: rev.dueAt?.toDate?.()?.toISOString() ?? null,
            last_reviewed: rev.lastReviewed?.toDate?.()?.toISOString() ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ cards });
}
