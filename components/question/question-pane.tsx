"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Question = {
  id: string;
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  explanation: string;
  difficulty: number;
};

export function QuestionPane({ slug }: { slug: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/questions?slug=${slug}&n=5`);
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setStartTime(Date.now());
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="text-ink-500 italic">Cargando preguntas…</div>
    );
  }
  if (!questions.length) {
    return <p className="text-ink-500">No hay preguntas disponibles.</p>;
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  async function check(letter: string) {
    setChosen(letter);
    setRevealed(true);
    await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: q.id,
        chosen: letter,
        timeMs: Date.now() - startTime,
      }),
    });
  }

  function next() {
    if (isLast) {
      setIdx(0);
      // Refetch a fresh batch.
      setLoading(true);
      fetch(`/api/questions?slug=${slug}&n=5`).then(async (r) => {
        const data = await r.json();
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

  return (
    <div>
      <div className="flex justify-between items-center text-xs text-ink-400 mb-3">
        <span>Pregunta {idx + 1} de {questions.length}</span>
        <span>Dificultad: {"●".repeat(q.difficulty)}{"○".repeat(5 - q.difficulty)}</span>
      </div>

      <p className="text-ink-900 leading-relaxed mb-5">{q.stem}</p>

      <div className="space-y-2">
        {q.options.map((opt) => {
          const isCorrect = opt.letter === q.correct;
          const isChosen = opt.letter === chosen;
          return (
            <button
              key={opt.letter}
              disabled={revealed}
              onClick={() => check(opt.letter)}
              className={cn(
                "w-full text-left rounded-lg border px-4 py-3 transition flex gap-3",
                !revealed && "border-bone-200 bg-white/60 hover:border-teal-400 hover:bg-white",
                revealed && isCorrect && "border-sage-500 bg-sage-500/10",
                revealed && !isCorrect && isChosen && "border-rust-500 bg-rust-500/10",
                revealed && !isCorrect && !isChosen && "border-bone-200 bg-bone-100/40 opacity-70",
              )}
            >
              <span className="font-mono text-sm text-ink-500">{opt.letter}.</span>
              <span className="text-ink-800">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="mt-5 rounded-lg border border-bone-200 bg-bone-100/60 p-4 animate-fade-up">
          <p className="font-display text-lg text-teal-700 mb-1">
            {chosen === q.correct ? "Correcto" : `Respuesta correcta: ${q.correct}`}
          </p>
          <p className="text-ink-700 text-sm leading-relaxed">{q.explanation}</p>
          <button
            onClick={next}
            className="mt-4 rounded-md bg-teal-600 text-bone-50 px-4 py-2 text-sm hover:bg-teal-700"
          >
            {isLast ? "Siguiente lote" : "Siguiente"}
          </button>
        </div>
      )}
    </div>
  );
}
