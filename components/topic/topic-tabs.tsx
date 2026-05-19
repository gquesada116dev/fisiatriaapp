"use client";
import { useState } from "react";
import { SummaryPane } from "./summary-pane";
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
      <div className="animate-fade-up">
        {tab === "summary" && <SummaryPane slug={slug} />}
        {tab === "questions" && <QuestionPane slug={slug} />}
        {tab === "flashcards" && <FlashcardPane slug={slug} />}
        {tab === "podcast" && <PodcastPane slug={slug} topicName={topicName} />}
      </div>
    </div>
  );
}
