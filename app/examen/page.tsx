import { TopBar } from "@/components/layout/top-bar";
import { ExamMode } from "@/components/examen/exam-mode";

export const dynamic = "force-dynamic";

export default function ExamenPage() {
  return (
    <>
      <TopBar />
      <main className="container py-10 max-w-3xl relative z-10">
        <div className="mb-8">
          <h1 className="font-display text-4xl text-ink-900">Modo Examen</h1>
          <p className="text-ink-500 mt-2">
            Preguntas de todos los temas · 6 opciones · explicación por opción · tutor IA disponible
          </p>
        </div>
        <ExamMode />
      </main>
    </>
  );
}
