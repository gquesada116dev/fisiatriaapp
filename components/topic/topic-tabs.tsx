"use client";
import { useState } from "react";
import { SummaryPane } from "./summary-pane";
import { Notepad } from "./notepad";
import { MiniMentor } from "./mini-mentor";
import { QuestionPane } from "@/components/question/question-pane";
import { FlashcardPane } from "@/components/flashcard/flashcard-pane";
import { PodcastPane } from "@/components/podcast/podcast-pane";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "questions", label: "Preguntas" },
  { key: "flashcards", label: "Tarjetas" },
  { key: "podcast", label: "Podcast" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function TopicTabs({ slug, topicName }: { slug: string; topicName: string }) {
  const [tab, setTab] = useState<TabKey>("summary");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-bone-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm border-b-2 -mb-px transition",
              tab === t.key
                ? "border-teal-600 text-teal-700 font-medium"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary tab — 3-panel layout */}
      {tab === "summary" && (
        <div
          className="grid gap-4 animate-fade-up"
          style={{
            gridTemplateColumns: "45% 55%",
            height: "calc(100vh - 220px)",
            minHeight: 600,
          }}
        >
          {/* Left: Summary */}
          <div className="overflow-y-auto pr-2">
            <SummaryPane slug={slug} />
          </div>

          {/* Right: Notepad (top) + Mini Mentor (bottom) */}
          <div className="flex flex-col gap-3 min-h-0">
            <div style={{ flex: "3", minHeight: 0 }}>
              <Notepad slug={slug} />
            </div>
            <div style={{ flex: "2", minHeight: 0 }}>
              <MiniMentor slug={slug} topicName={topicName} />
            </div>
          </div>
        </div>
      )}

      {/* Other tabs — full width */}
      <div className={cn("animate-fade-up", tab === "summary" && "hidden")}>
        {tab === "questions" && <QuestionPane slug={slug} />}
        {tab === "flashcards" && <FlashcardPane slug={slug} />}
        {tab === "podcast" && <PodcastPane slug={slug} topicName={topicName} />}
      </div>
    </div>
  );
}
