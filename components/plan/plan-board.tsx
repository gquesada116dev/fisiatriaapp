"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { STUDY_PLAN, COMPLETED_TOPICS, TOTAL_STUDY_TOPICS, todayCR, type PlanItem } from "@/lib/study-plan";

type Stats = Record<string, { mastery?: number }>;

const PRIO_LABEL: Record<number, { text: string; cls: string }> = {
  5: { text: "ALTO", cls: "bg-rust-500/10 text-rust-600 border-rust-500/20" },
  4: { text: "ALTO", cls: "bg-rust-500/10 text-rust-600 border-rust-500/20" },
  3: { text: "MED", cls: "bg-teal-500/10 text-teal-700 border-teal-500/20" },
  2: { text: "BAJO", cls: "bg-ink-400/10 text-ink-500 border-ink-400/20" },
  1: { text: "BAJO", cls: "bg-ink-400/10 text-ink-500 border-ink-400/20" },
};

export function PlanBoard({ stats, initialDone }: { stats: Stats; initialDone: Record<string, boolean> }) {
  const [done, setDone] = useState<Record<string, boolean>>(initialDone);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const today = todayCR();

  const completedTopics = useMemo(() => {
    const planItems = STUDY_PLAN.filter((d) => d.kind === "study").flatMap((d) => d.items);
    return [...COMPLETED_TOPICS, ...planItems].filter((i) => done[i.key]).length;
  }, [done]);

  async function toggle(key: string) {
    const next = !done[key];
    setDone((d) => ({ ...d, [key]: next }));        // optimista
    setPending((p) => new Set(p).add(key));
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setDone((d) => ({ ...d, [key]: !next }));      // revertir si falla
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(key); return n; });
    }
  }

  const pct = Math.round((completedTopics / TOTAL_STUDY_TOPICS) * 100);

  return (
    <div>
      {/* Progreso */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display text-2xl text-teal-700">{completedTopics}/{TOTAL_STUDY_TOPICS} temas</span>
          <span className="text-sm text-ink-500">{pct}% del plan</span>
        </div>
        <div className="h-2 rounded-full bg-bone-200 overflow-hidden">
          <div className="h-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Ya estudiado antes del plan */}
      <div className="mb-3 rounded-xl border border-sage-500/30 bg-sage-500/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-widest text-sage-600 font-medium">Ya estudiado</span>
          <span className="text-xs text-ink-400">¡buen avance! 💪</span>
        </div>
        <ul className="space-y-1.5">
          {COMPLETED_TOPICS.map((item) => (
            <PlanRow
              key={item.key}
              item={item}
              checked={!!done[item.key]}
              busy={pending.has(item.key)}
              mastery={item.slug ? stats[item.slug]?.mastery : undefined}
              onToggle={() => toggle(item.key)}
            />
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {STUDY_PLAN.map((day) => {
          const isToday = day.date === today;
          const allDone = day.items.every((i) => done[i.key]);
          return (
            <div
              key={day.date}
              className={cn(
                "rounded-xl border p-4 transition relative",
                isToday ? "border-teal-400 bg-teal-50/60 ring-1 ring-teal-400/40" : "border-bone-200 bg-white/60",
                allDone && !isToday && "opacity-70",
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs uppercase tracking-widest text-ink-400 w-24 shrink-0">
                  {day.dow} {day.date.slice(8)}/{day.date.slice(5, 7)}
                </span>
                {isToday && (
                  <span className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-full bg-teal-600 text-bone-50">
                    HOY
                  </span>
                )}
                {day.kind === "exam" && (
                  <span className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-full bg-rust-500 text-bone-50">
                    EXAMEN
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {day.items.map((item) => (
                  <PlanRow
                    key={item.key}
                    item={item}
                    checked={!!done[item.key]}
                    busy={pending.has(item.key)}
                    mastery={item.slug ? stats[item.slug]?.mastery : undefined}
                    onToggle={() => toggle(item.key)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanRow({
  item, checked, busy, mastery, onToggle,
}: {
  item: PlanItem;
  checked: boolean;
  busy: boolean;
  mastery?: number;
  onToggle: () => void;
}) {
  const prio = item.priority ? PRIO_LABEL[item.priority] : null;
  return (
    <li className="flex items-start gap-3">
      <button
        onClick={onToggle}
        disabled={busy}
        aria-pressed={checked}
        aria-label={`Marcar ${item.name}`}
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center transition",
          checked ? "bg-sage-500 border-sage-500 text-bone-50" : "border-ink-400/40 bg-white hover:border-teal-400",
          busy && "opacity-50",
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {item.slug ? (
            <Link
              href={`/topics/${item.slug}`}
              className={cn("text-ink-900 hover:text-teal-700 leading-snug", checked && "line-through text-ink-400")}
            >
              {item.name}
            </Link>
          ) : (
            <span className={cn("text-ink-700 leading-snug", checked && "line-through text-ink-400")}>{item.name}</span>
          )}
          {prio && (
            <span className={cn("text-[10px] tracking-wider px-1.5 py-0.5 rounded border", prio.cls)}>{prio.text}</span>
          )}
          {mastery !== undefined && mastery > 0 && (
            <span className="text-xs text-ink-400">{Math.round(mastery * 100)}% dominio</span>
          )}
        </div>
        {item.note && <p className="text-xs text-ink-400 mt-0.5">{item.note}</p>}
      </div>
    </li>
  );
}
