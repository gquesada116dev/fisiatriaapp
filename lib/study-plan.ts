/**
 * Plan de estudio de Bele — examen 5 julio 2026.
 * Config estática (el calendario no cambia). El estado de "completado"
 * se persiste en Firestore (colección studyPlanProgress, doc "bele").
 *
 * Cada día tiene items: temas de estudio (con slug) o tareas de repaso (sin slug).
 * El campo `key` identifica cada item para marcar completado:
 *   - temas → su slug
 *   - repaso/examen → "day-<fecha>"
 */

export type PlanItem = {
  key: string;
  name: string;
  slug?: string;        // si es un tema (link a /topics/<slug>)
  priority?: 1 | 2 | 3 | 4 | 5;
  note?: string;
};

export type PlanDay = {
  date: string;         // YYYY-MM-DD
  dow: string;          // día de la semana (es)
  kind: "study" | "review" | "exam";
  items: PlanItem[];
};

const topic = (slug: string, name: string, priority: 1 | 2 | 3 | 4 | 5, note?: string): PlanItem =>
  ({ key: slug, slug, name, priority, note });

export const STUDY_PLAN: PlanDay[] = [
  { date: "2026-06-17", dow: "Mié", kind: "study", items: [topic("escoliosis-y-cifosis", "Escoliosis y cifosis", 3, "Ya tiene contenido listo")] },
  { date: "2026-06-18", dow: "Jue", kind: "study", items: [topic("ulceras-por-presion", "Úlceras por presión", 5, "Tema pesado — día completo")] },
  { date: "2026-06-19", dow: "Vie", kind: "study", items: [topic("espasticidad", "Espasticidad", 5)] },
  { date: "2026-06-20", dow: "Sáb", kind: "study", items: [
    topic("lesiones-medulares-cap-156", "Lesión medular — Clasificación (cap 156)", 5),
    topic("lesiones-medulares-cap-157", "Lesión medular — Complicaciones (cap 157)", 5),
  ] },
  { date: "2026-06-21", dow: "Dom", kind: "study", items: [
    topic("lesiones-medulares-cap-158", "Lesión medular — Rehabilitación (cap 158)", 5),
    topic("neuralgia-del-trigemino", "Neuralgia del trigémino", 3),
  ] },
  { date: "2026-06-22", dow: "Lun", kind: "study", items: [topic("evento-cerebrovascular", "Evento cerebrovascular", 5, "Tema pesado — día completo")] },
  { date: "2026-06-23", dow: "Mar", kind: "study", items: [topic("lesion-cerebral-traumatica", "Lesión cerebral traumática", 5)] },
  { date: "2026-06-24", dow: "Mié", kind: "study", items: [topic("artrosis", "Artrosis", 4)] },
  { date: "2026-06-25", dow: "Jue", kind: "study", items: [topic("sindrome-dolor-miofascial", "Síndrome de dolor miofascial", 4)] },
  { date: "2026-06-26", dow: "Vie", kind: "study", items: [topic("neuropatias-perifericas", "Neuropatías periféricas", 4)] },
  { date: "2026-06-27", dow: "Sáb", kind: "study", items: [
    topic("sindrome-regional-complejo-doloroso", "Síndrome regional complejo doloroso", 4),
    topic("fibromialgia", "Fibromialgia", 3),
  ] },
  { date: "2026-06-28", dow: "Dom", kind: "study", items: [
    topic("informe-mundial-discapacidad-2011", "Informe Mundial sobre Discapacidad 2011", 3),
    topic("historia-examen-fisico-pediatrico", "Historia y examen físico pediátrico", 3),
  ] },
  { date: "2026-06-29", dow: "Lun", kind: "study", items: [topic("rehabilitacion-politrauma", "Rehabilitación del politrauma", 4)] },
  { date: "2026-06-30", dow: "Mar", kind: "study", items: [topic("historia-clinica-examen-fisico-fisiátrico", "Historia clínica y examen físico fisiátrico", 4)] },
  { date: "2026-07-01", dow: "Mié", kind: "study", items: [topic("neuralgia-posherpetica", "Neuralgia postherpética", 3, "Solo lo de alto rendimiento")] },
  { date: "2026-07-02", dow: "Jue", kind: "review", items: [{ key: "day-2026-07-02", name: "Repaso — temas P5 (flashcards + quizzes)" }] },
  { date: "2026-07-03", dow: "Vie", kind: "review", items: [{ key: "day-2026-07-03", name: "Repaso — temas débiles + buffer de atraso" }] },
  { date: "2026-07-04", dow: "Sáb", kind: "review", items: [{ key: "day-2026-07-04", name: "Repaso final — simulacro de examen" }] },
  { date: "2026-07-05", dow: "Dom", kind: "exam", items: [{ key: "day-2026-07-05", name: "🎯 EXAMEN" }] },
];

/** Total de temas de estudio (para la barra de progreso). */
export const TOTAL_STUDY_TOPICS = STUDY_PLAN
  .filter((d) => d.kind === "study")
  .reduce((acc, d) => acc + d.items.length, 0);

/** Fecha de hoy (YYYY-MM-DD) en zona horaria de Costa Rica. */
export function todayCR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}
