import { notFound } from "next/navigation";
import { db } from "@/lib/db/firebase";
import { TopBar } from "@/components/layout/top-bar";
import { TopicTabs } from "@/components/topic/topic-tabs";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: { slug: string } }) {
  const firestore = db();
  const [topicSnap, statsSnap] = await Promise.all([
    firestore.collection("topics").doc(params.slug).get(),
    firestore.collection("topicStats").doc(params.slug).get(),
  ]);

  if (!topicSnap.exists) notFound();
  const topic = { slug: params.slug, ...topicSnap.data() } as any;
  const stats = statsSnap.exists ? statsSnap.data()! : null;

  const mcqAccuracy =
    stats && stats.mcqAttempts > 0 ? stats.mcqCorrect / stats.mcqAttempts : 0;

  return (
    <>
      <TopBar />
      <main className="container py-8 max-w-\[1400px\] relative z-10">
        <p className="text-xs uppercase tracking-widest text-ink-400 mb-2">{topic.category}</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink-900 leading-tight">{topic.name}</h1>
        <p className="text-ink-600 mt-2 max-w-2xl">{topic.description}</p>

        {stats && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-500">
            <span>Dominio: <strong className="text-teal-700">{Math.round((stats.mastery ?? 0) * 100)}%</strong></span>
            <span>Tarjetas: {stats.correctCards ?? 0}/{stats.totalCards ?? 0} correctas</span>
          </div>
        )}

        <div className="mt-8">
          <TopicTabs slug={topic.slug} topicName={topic.name} />
        </div>
      </main>
    </>
  );
}
