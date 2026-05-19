import { NextResponse } from "next/server";
import { db, FieldValue, Timestamp } from "@/lib/db/firebase";
import { generateJson } from "@/lib/ai/client";
import { flashcardsPrompt, type GeneratedFlashcard } from "@/lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS, PROMPT_VERSIONS } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const CARDS_PER_TOPIC = 25;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();

  const topicSnap = await firestore.collection("topics").doc(slug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  const topic = { slug, ...topicSnap.data() } as any;

  const existingSnap = await firestore
    .collection("flashcards")
    .where("topicSlug", "==", slug)
    .limit(1)
    .get();

  if (existingSnap.empty) {
    const { cards } = await generateJson<{ cards: GeneratedFlashcard[] }>({
      model: AI_MODELS.flashcards,
      system: flashcardsPrompt(topic, CARDS_PER_TOPIC).system,
      prompt: flashcardsPrompt(topic, CARDS_PER_TOPIC).user,
      maxTokens: MAX_TOKENS.flashcards,
    });

    const batch = firestore.batch();

    for (const c of cards) {
      const cardRef = firestore.collection("flashcards").doc();
      batch.set(cardRef, {
        topicSlug: slug,
        front: c.front,
        back: c.back,
        tags: c.tags ?? [],
        model: AI_MODELS.flashcards,
        promptV: PROMPT_VERSIONS.flashcards,
        createdAt: Timestamp.now(),
      });
      // Denormalize card data into the review doc for the global review page.
      const reviewRef = firestore.collection("flashcardReviews").doc(cardRef.id);
      batch.set(reviewRef, {
        flashcardId: cardRef.id,
        topicSlug: slug,
        topicName: topic.name,
        front: c.front,
        back: c.back,
        tags: c.tags ?? [],
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        dueAt: Timestamp.now(),
        lastReviewed: null,
        lastQuality: null,
      });
    }

    await batch.commit();

    // Update topicStats with the new card count.
    await firestore
      .collection("topicStats")
      .doc(slug)
      .set(
        { totalCards: FieldValue.increment(cards.length), matureCards: 0, mcqAttempts: 0, mcqCorrect: 0 },
        { merge: true },
      );
  }

  const deckSnap = await firestore.collection("flashcards").where("topicSlug", "==", slug).get();
  const reviewSnap = await firestore
    .collection("flashcardReviews")
    .where("topicSlug", "==", slug)
    .get();
  const reviewMap = new Map(reviewSnap.docs.map((d) => [d.id, d.data()]));

  const cards = deckSnap.docs.map((d) => {
    const rev = reviewMap.get(d.id);
    return {
      id: d.id,
      front: d.data().front,
      back: d.data().back,
      tags: d.data().tags,
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
