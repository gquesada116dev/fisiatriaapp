import { db, Timestamp } from "@/lib/db/firebase";
import { TopBar } from "@/components/layout/top-bar";
import { GlobalReview } from "@/components/flashcard/global-review";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const firestore = db();

  // flashcardReviews stores front/back/topicName/topicSlug denormalized — no join needed.
  const snap = await firestore
    .collection("flashcardReviews")
    .where("dueAt", "<=", Timestamp.now())
    .orderBy("dueAt")
    .limit(100)
    .get();

  const cards = snap.docs.map((d) => {
    const r = d.data();
    return {
      id: d.id,
      front: r.front,
      back: r.back,
      tags: r.tags ?? [],
      topicName: r.topicName ?? "",
      topicSlug: r.topicSlug ?? "",
    };
  });

  return (
    <>
      <TopBar />
      <main className="container py-10 max-w-2xl relative z-10">
        <h1 className="font-display text-4xl text-ink-900 mb-2">Repaso</h1>
        <p className="text-ink-500 mb-8">
          {cards.length} tarjeta{cards.length === 1 ? "" : "s"} pendiente{cards.length === 1 ? "" : "s"} de repaso.
        </p>
        <GlobalReview cards={cards as any} />
      </main>
    </>
  );
}
