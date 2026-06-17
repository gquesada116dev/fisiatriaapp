import { db } from "@/lib/db/firebase";
import { TopBar } from "@/components/layout/top-bar";
import { PlanBoard } from "@/components/plan/plan-board";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const firestore = db();
  const [statsSnap, progressSnap] = await Promise.all([
    firestore.collection("topicStats").get(),
    firestore.collection("studyPlanProgress").doc("bele").get(),
  ]);

  const stats: Record<string, { mastery?: number }> = {};
  statsSnap.docs.forEach((d) => { stats[d.id] = { mastery: d.data().mastery ?? 0 }; });

  const initialDone: Record<string, boolean> = progressSnap.exists ? (progressSnap.data()?.done ?? {}) : {};

  return (
    <>
      <TopBar />
      <main className="container py-10 max-w-2xl relative z-10">
        <h1 className="font-display text-4xl text-ink-900 mb-1">Plan de estudio</h1>
        <p className="text-ink-500 mb-8">Examen: 5 de julio. Marcá cada tema al terminarlo.</p>
        <PlanBoard stats={stats} initialDone={initialDone} />
      </main>
    </>
  );
}
