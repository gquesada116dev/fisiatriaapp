"use client";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { TutorChat } from "./tutor-chat";

type ExamQuestion = {
  id: string;
  topicSlug: string;
  topicName: string;
  topicCategory: string;
  stem: string;
  options: { letter: string; text: string }[];
  correct: string;
  explanations: Record<string, string>;
  difficulty: number;
};

export function ExamMode() {
  const [queue, setQueue] = useState<ExamQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/examen?n=10");
    const data = await res.json();
    setQueue(data.questions ?? []);
    setIdx(0);
    setChosen(null);
    setRevealed(false);
    setStartTime(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  async function answer(letter: string) {
    if (revealed) return;
    setChosen(letter);
    setRevealed(true);

    const q = queue[idx];
    const isCorrect = letter === q.correct;
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    await fetch("/api/examen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, chosen: letter, timeMs: Date.now() - startTime }),
    });
  }

  function next() {
    if (idx >= queue.length - 1) {
      loadQuestions();
    } else {
      setIdx((i) => i + 1);
      setChosen(null);
      setRevealed(false);
      setStartTime(Date.now());
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-ink-500">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm">Cargando preguntas…</p>
        <p className="text-xs text-ink-400 mt-1">La primera vez puede tomar ~15 segundos mientras se genera el banco</p>
      </div>
    );
  }

  if (!queue.length) {
    return <p className="text-ink-500 text-center py-16">No hay preguntas disponibles.</p>;
  }

  const q = queue[idx];

  return (
    <div className="relative">
      {/* Score bar */}
      <div className="flex items-center justify-between text-xs text-ink-400 mb-6">
        <span className="bg-bone-100 border border-bone-200 px-3 py-1 rounded-full">
          {q.topicCategory} · <span className="text-ink-600">{q.topicName}</span>
        </span>
        <span>
          {score.total > 0 && (
            <span className={cn("font-medium", score.correct / score.total >= 0.7 ? "text-teal-600" : "text-rust-600")}>
              {score.correct}/{score.total}
            </span>
          )}
          {" "}· {"●".repeat(q.difficulty)}{"○".repeat(5 - q.difficulty)}
        </span>
      </div>

      {/* Stem */}
      <p className="text-ink-900 leading-relaxed text-base mb-6">{q.stem}</p>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((opt) => {
          const isCorrect = opt.letter === q.correct;
          const isChosen = opt.letter === chosen;
          return (
            <div key={opt.letter}>
              <button
                disabled={revealed}
                onClick={() => answer(opt.letter)}
                className={cn(
                  "w-full text-left rounded-xl border px-4 py-3 transition flex gap-3 items-start",
                  !revealed && "border-bone-200 bg-white/60 hover:border-teal-400 hover:bg-white cursor-pointer",
                  revealed && isCorrect && "border-teal-500 bg-teal-500/10",
                  revealed && !isCorrect && isChosen && "border-red-400 bg-red-400/10",
                  revealed && !isCorrect && !isChosen && "border-bone-200 bg-bone-50 opacity-60",
                )}
              >
                <span className={cn(
                  "font-mono text-sm mt-0.5 shrink-0 w-5",
                  revealed && isCorrect && "text-teal-700 font-bold",
                  revealed && !isCorrect && isChosen && "text-red-600 font-bold",
                )}>
                  {opt.letter}.
                </span>
                <span className="text-ink-800 text-sm">{opt.text}</span>
                {revealed && isCorrect && <span className="ml-auto text-teal-600 shrink-0">✓</span>}
                {revealed && !isCorrect && isChosen && <span className="ml-auto text-red-500 shrink-0">✗</span>}
              </button>

              {/* Per-option explanation */}
              {revealed && (
                <div className={cn(
                  "mx-1 px-4 py-2 rounded-b-xl border-x border-b text-xs leading-relaxed",
                  isCorrect ? "border-teal-500/40 bg-teal-50 text-teal-800" : "border-bone-200 bg-bone-50 text-ink-500",
                )}>
                  {q.explanations[opt.letter]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions after reveal */}
      {revealed && (
        <div className="mt-6 flex flex-wrap gap-3 animate-fade-up">
          <button
            onClick={() => setTutorOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-teal-400 text-teal-700 px-4 py-2 text-sm hover:bg-teal-50 transition"
          >
            <span>💬</span> Preguntar al tutor
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-teal-600 text-white px-5 py-2 text-sm hover:bg-teal-700 transition"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Tutor slide-over */}
      {tutorOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setTutorOpen(false)}
          />
          <TutorChat
            question={q.stem}
            options={q.options}
            correct={q.correct}
            explanations={q.explanations}
            topicName={q.topicName}
            onClose={() => setTutorOpen(false)}
          />
        </>
      )}
    </div>
  );
}
