"use client";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Review = {
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  due_at: string;
  last_reviewed: string | null;
};
type Card = { id: string; front: string; back: string; tags: string[]; review: Review | Review[] | null; imageUrl?: string | null };

function normalizeReview(r: Card["review"]): Review | null {
  if (!r) return null;
  if (Array.isArray(r)) return r[0] ?? null;
  return r;
}

const QUALITIES = [
  { q: 0, label: "Fallé", hint: "no recordé", cls: "bg-rust-500/10 text-rust-600 border-rust-500/30" },
  { q: 3, label: "Difícil", hint: "con esfuerzo", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { q: 4, label: "Bien", hint: "con un titubeo", cls: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  { q: 5, label: "Fácil", hint: "perfecto", cls: "bg-sage-500/10 text-sage-500 border-sage-500/30" },
] as const;

export function FlashcardPane({ slug }: { slug: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/flashcards?slug=${slug}`);
      const data = await res.json();
      setCards(data.cards ?? []);
      setLoading(false);
    })();
  }, [slug]);

  // Order due-first, then new (no review yet).
  const queue = useMemo(() => {
    const now = Date.now();
    return [...cards].sort((a, b) => {
      const ar = normalizeReview(a.review);
      const br = normalizeReview(b.review);
      const aDue = ar ? new Date(ar.due_at).getTime() - now : Number.POSITIVE_INFINITY;
      const bDue = br ? new Date(br.due_at).getTime() - now : Number.POSITIVE_INFINITY;
      // due (negative) first, then new (no review), then future.
      const aRank = !ar ? 1 : aDue <= 0 ? 0 : 2;
      const bRank = !br ? 1 : bDue <= 0 ? 0 : 2;
      if (aRank !== bRank) return aRank - bRank;
      return aDue - bDue;
    });
  }, [cards]);

  if (loading) return <p className="text-ink-500 italic">Cargando tarjetas…</p>;
  if (!queue.length) return <p className="text-ink-500">No hay tarjetas para este tema.</p>;

  const card = queue[idx % queue.length];

  async function grade(q: number) {
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId: card.id, quality: q }),
    });
    setFlipped(false);
    setIdx((i) => (i + 1) % queue.length);
  }

  const review = normalizeReview(card.review);

  return (
    <div>
      <div className="flex justify-between text-xs text-ink-400 mb-3">
        <span>Tarjeta {idx + 1} de {queue.length}</span>
        {review && (
          <span>
            Intervalo: {review.interval_days}d · EF: {review.ease_factor.toFixed(2)}
          </span>
        )}
      </div>

      <div
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          "min-h-[220px] rounded-2xl border border-bone-200 bg-white/70 p-8 cursor-pointer",
          "flex items-center justify-center text-center transition hover:border-teal-400",
        )}
      >
        <div className="w-full">
          <p className="text-xs uppercase tracking-widest text-ink-400 mb-3">
            {flipped ? "Reverso" : "Frente"}
          </p>
          {card.imageUrl && !flipped && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt="Imagen de la tarjeta" className="mx-auto max-h-48 object-contain rounded-lg mb-4 border border-bone-200" />
          )}
          <p className="font-display text-2xl text-ink-900 leading-relaxed">
            {flipped ? card.back : card.front}
          </p>
          {!flipped && (
            <p className="text-xs text-ink-400 mt-4 italic">Click para revelar</p>
          )}
        </div>
      </div>

      {flipped && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-up">
          {QUALITIES.map((g) => (
            <button
              key={g.q}
              onClick={() => grade(g.q)}
              className={cn(
                "rounded-lg border px-3 py-3 text-sm transition hover:scale-[1.02]",
                g.cls,
              )}
            >
              <div className="font-medium">{g.label}</div>
              <div className="text-xs opacity-70">{g.hint}</div>
            </button>
          ))}
        </div>
      )}

      {card.tags?.length > 0 && (
        <div className="mt-4 flex gap-1.5 flex-wrap">
          {card.tags.map((t) => (
            <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-bone-200 text-ink-500">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
