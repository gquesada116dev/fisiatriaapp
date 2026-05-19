import Link from "next/link";
import { db } from "@/lib/db/firebase";
import { TopBar } from "@/components/layout/top-bar";

export const dynamic = "force-dynamic";

type TopicRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  priority: number;
  sortOrder: number;
};
type ProgressRow = { mastery: number; mcqAttempts: number; totalCards: number };

export default async function HomePage() {
  const firestore = db();
  const [topicsSnap, statsSnap] = await Promise.all([
    firestore.collection("topics").orderBy("sortOrder").get(),
    firestore.collection("topicStats").get(),
  ]);

  const topics: TopicRow[] = topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  const progressMap = new Map<string, ProgressRow>(
    statsSnap.docs.map((d) => [d.id, d.data() as ProgressRow]),
  );

  // Group by category, preserving seed order.
  const grouped: Record<string, TopicRow[]> = {};
  topics.forEach((t) => {
    grouped[t.category] = grouped[t.category] ?? [];
    grouped[t.category].push(t);
  });

  const allStats = statsSnap.docs.map((d) => d.data());
  const totalMastery =
    allStats.reduce((acc, p) => acc + (p.mastery ?? 0), 0) / Math.max(1, topics.length);

  return (
    <>
      <TopBar />
      <main className="container py-10 relative z-10">
        {/* Hero */}
        <section className="mb-12 max-w-3xl">
          <h1 className="font-display text-5xl md:text-6xl text-ink-900 leading-[1.05]">
            Estudio para <span className="text-teal-700 italic">fisiatría</span>.
          </h1>
          <p className="mt-4 text-ink-600 text-lg">
            Resúmenes, preguntas, tarjetas y podcasts — todo enfocado al examen de segunda etapa.
          </p>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-4xl text-teal-700">
              {Math.round(totalMastery * 100)}%
            </span>
            <span className="text-ink-500 text-sm">dominio general</span>
          </div>
        </section>

        {/* Categories */}
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-12">
            <div className="flex items-baseline justify-between mb-4 border-b border-bone-200 pb-2">
              <h2 className="font-display text-2xl text-ink-900">{category}</h2>
              <span className="text-xs uppercase tracking-widest text-ink-400">
                {items.length} temas
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((t) => {
                const p = progressMap.get(t.slug);
                const mastery = Math.round((p?.mastery ?? 0) * 100);
                return (
                  <Link
                    key={t.id}
                    href={`/topics/${t.slug}`}
                    className="group rounded-xl border border-bone-200 bg-white/60 p-4 hover:border-teal-400 hover:bg-white transition relative overflow-hidden"
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-500/70 transition-all"
                      style={{ width: `${mastery}%` }}
                      aria-hidden
                    />
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-ink-900 group-hover:text-teal-700 leading-snug">
                        {t.name}
                      </h3>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="text-sm text-ink-500 mt-1 line-clamp-2">{t.description}</p>
                    <div className="mt-3 flex justify-between items-center text-xs text-ink-400">
                      <span>{mastery}% dominio</span>
                      <span>{p?.mcqAttempts ?? 0} preguntas</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  const labels: Record<number, { text: string; cls: string }> = {
    5: { text: "ALTO", cls: "bg-rust-500/10 text-rust-600 border-rust-500/20" },
    4: { text: "ALTO", cls: "bg-rust-500/10 text-rust-600 border-rust-500/20" },
    3: { text: "MED", cls: "bg-teal-500/10 text-teal-700 border-teal-500/20" },
    2: { text: "BAJO", cls: "bg-ink-400/10 text-ink-500 border-ink-400/20" },
    1: { text: "BAJO", cls: "bg-ink-400/10 text-ink-500 border-ink-400/20" },
  };
  const l = labels[priority] ?? labels[3];
  return (
    <span className={`text-[10px] tracking-wider px-1.5 py-0.5 rounded border ${l.cls}`}>
      {l.text}
    </span>
  );
}
