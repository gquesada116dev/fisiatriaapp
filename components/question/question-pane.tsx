"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Question = {
  id: string;
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  explanations?: Record<string, string>;
  difficulty: number;
  imageUrl?: string | null;
};

export function QuestionPane({ slug }: { slug: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/questions?slug=${slug}&n=5`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setQuestions(data.questions ?? []);
      } catch {
        setQuestions([]);
      }
      setStartTime(Date.now());
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="text-ink-500 italic">Cargando preguntas…</div>;
  if (!questions.length) return <p className="text-ink-500">No hay preguntas disponibles para este tema.</p>;

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  async function check(letter: string) {
    setChosen(letter);
    setRevealed(true);
    const isCorrect = letter === q.correct;
    setSessionTotal((t) => t + 1);
    if (isCorrect) setSessionCorrect((c) => c + 1);
    fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, chosen: letter, timeMs: Date.now() - startTime }),
    });
  }

  function next() {
    if (isLast) {
      setIdx(0);
      setLoading(true);
      fetch(`/api/questions?slug=${slug}&n=5`).then(async (r) => {
        const data = r.ok ? await r.json() : { questions: [] };
        setQuestions(data.questions ?? []);
        setLoading(false);
      });
    } else {
      setIdx((i) => i + 1);
    }
    setChosen(null);
    setRevealed(false);
    setStartTime(Date.now());
  }

  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null;

  return (
    <div>
      {/* Header: progress + score */}
      <div className="flex justify-between items-center text-xs text-ink-400 mb-3">
        <span>Pregunta {idx + 1} de {questions.length}</span>
        <div className="flex items-center gap-3">
          {accuracy !== null && (
            <span className={cn(
              "font-medium",
              accuracy >= 70 ? "text-sage-600" : accuracy >= 50 ? "text-amber-600" : "text-rust-600"
            )}>
              {sessionCorrect}/{sessionTotal} correctas ({accuracy}%)
            </span>
          )}
          <span>Dificultad: {"●".repeat(q.difficulty)}{"○".repeat(5 - q.difficulty)}</span>
        </div>
      </div>

      {q.imageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-bone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.imageUrl} alt="Imagen de la pregunta" className="w-full max-h-72 object-contain bg-white" />
        </div>
      )}
      <p className="text-ink-900 leading-relaxed mb-5">{q.stem}</p>

      <div className="space-y-2">
        {q.options.map((opt) => {
          const isCorrect = opt.letter === q.correct;
          const isChosen = opt.letter === chosen;
          const explanation = q.explanations?.[opt.letter];
          return (
            <div key={opt.letter}>
              <button
                disabled={revealed}
                onClick={() => check(opt.letter)}
                className={cn(
                  "w-full text-left rounded-lg border px-4 py-3 transition flex gap-3",
                  !revealed && "border-bone-200 bg-white/60 hover:border-teal-400 hover:bg-white",
                  revealed && isCorrect && "border-sage-500 bg-sage-500/10",
                  revealed && !isCorrect && isChosen && "border-rust-500 bg-rust-500/10",
                  revealed && !isCorrect && !isChosen && "border-bone-200 bg-bone-100/40 opacity-60",
                )}
              >
                <span className="font-mono text-sm text-ink-500 shrink-0">{opt.letter}.</span>
                <span className="text-ink-800">{opt.text}</span>
              </button>
              {revealed && explanation && (
                <p className={cn(
                  "mt-1 ml-4 px-3 py-2 text-xs leading-relaxed rounded-md",
                  isCorrect ? "text-sage-700 bg-sage-500/5" : "text-ink-500 bg-bone-100/50",
                )}>
                  {explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {revealed && (
        <div className="mt-5 flex items-center justify-between">
          <p className={cn(
            "font-medium text-sm",
            chosen === q.correct ? "text-sage-600" : "text-rust-600"
          )}>
            {chosen === q.correct ? "Correcto" : `Correcto: ${q.correct}`}
          </p>
          <button
            onClick={next}
            className="rounded-md bg-teal-600 text-bone-50 px-4 py-2 text-sm hover:bg-teal-700"
          >
            {isLast ? "Siguiente lote" : "Siguiente →"}
          </button>
        </div>
      )}
    </div>
  );
}
