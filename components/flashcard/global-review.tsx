"use client";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ReviewCard = {
  id: string;
  front: string;
  back: string;
  tags: string[];
  topicName: string;
  topicSlug: string;
  imageUrl?: string | null;
};

const QUALITIES = [
  { q: 0, label: "Fallé", cls: "bg-rust-500/10 text-rust-600 border-rust-500/30" },
  { q: 3, label: "Difícil", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  { q: 4, label: "Bien", cls: "bg-teal-500/10 text-teal-700 border-teal-500/30" },
  { q: 5, label: "Fácil", cls: "bg-sage-500/10 text-sage-500 border-sage-500/30" },
] as const;

export function GlobalReview({ cards }: { cards: ReviewCard[] }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards.length) {
    return (
      <div className="rounded-xl border border-bone-200 bg-white/60 p-10 text-center">
        <p className="font-display text-2xl text-teal-700 mb-2">Al día</p>
        <p className="text-ink-500">No hay tarjetas pendientes. Vuelve más tarde.</p>
        <Link href="/" className="inline-block mt-4 text-teal-700 underline">Explorar temas</Link>
      </div>
    );
  }

  if (idx >= cards.length) {
    return (
      <div className="rounded-xl border border-bone-200 bg-white/60 p-10 text-center">
        <p className="font-display text-2xl text-teal-700 mb-2">¡Completado!</p>
        <p className="text-ink-500">Repasaste {cards.length} tarjetas. Buen trabajo.</p>
      </div>
    );
  }

  const card = cards[idx];

  async function grade(q: number) {
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId: card.id, quality: q }),
    });
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  return (
    <div>
      <div className="flex justify-between text-xs text-ink-400 mb-3">
        <span>Tarjeta {idx + 1} de {cards.length}</span>
        <Link href={`/topics/${card.topicSlug}`} className="hover:text-teal-700">
          {card.topicName} →
        </Link>
      </div>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="min-h-[220px] rounded-2xl border border-bone-200 bg-white/70 p-8 cursor-pointer flex items-center justify-center text-center hover:border-teal-400 transition"
      >
        <div className="w-full">
          <p className="text-xs uppercase tracking-widest text-ink-400 mb-3">
            {flipped ? "Reverso" : "Frente"}
          </p>
          {card.imageUrl && !flipped && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt="Imagen de la tarjeta" className="mx-auto max-h-48 object-contain rounded-lg mb-4 border border-bone-200" />
          )}
          <p className="font-display text-2xl text-ink-900">{flipped ? card.back : card.front}</p>
          {!flipped && <p className="text-xs text-ink-400 mt-4 italic">Click para revelar</p>}
        </div>
      </div>

      {flipped && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fade-up">
          {QUALITIES.map((g) => (
            <button
              key={g.q}
              onClick={() => grade(g.q)}
              className={cn("rounded-lg border px-3 py-3 text-sm transition hover:scale-[1.02]", g.cls)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
