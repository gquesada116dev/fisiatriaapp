"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Speaker = "A" | "B" | "C";
type PodcastType = "pre" | "post";
type Line = { speaker: Speaker; text: string; startS?: number; endS?: number };
type PodcastData = { exists: boolean; audioUrl?: string | null; script?: Line[]; durationS?: number };

const SPEAKER_NAME: Record<Speaker, string> = {
  A: "Dr. Marín",
  B: "Dra. Vargas",
  C: "Presentadora",
};
const SPEAKER_COLOR: Record<Speaker, string> = {
  A: "text-teal-700",
  B: "text-rust-600",
  C: "text-ink-400",
};
const SPEAKER_BG: Record<Speaker, string> = {
  A: "bg-teal-50 border-teal-200",
  B: "bg-rust-50 border-rust-200",
  C: "bg-bone-100 border-bone-200",
};

const TYPE_LABEL: Record<PodcastType, string> = {
  pre: "Pre-lectura",
  post: "Post-lectura",
};

export function PodcastPane({ slug, topicName }: { slug: string; topicName: string }) {
  const [podType, setPodType] = useState<PodcastType>("pre");
  const [data, setData] = useState<PodcastData | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasTiming = data?.script?.some((l) => l.startS != null) ?? false;

  useEffect(() => {
    setData(null);
    setActiveIdx(-1);
    fetch(`/api/podcast?slug=${slug}&type=${podType}`).then(async (r) => {
      setData(await r.json());
    });
  }, [slug, podType]);

  useEffect(() => {
    if (!data?.audioUrl) return;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${topicName} — ${TYPE_LABEL[podType]}`,
        artist: "FisiaPrep",
        album: "Fisiatría",
      });
      navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
      navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (audioRef.current) audioRef.current.currentTime -= 15;
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (audioRef.current) audioRef.current.currentTime += 30;
      });
    }
  }, [data, topicName, podType]);

  function handleTimeUpdate() {
    if (!hasTiming || !audioRef.current || !data?.script) return;
    const t = audioRef.current.currentTime;
    const idx = data.script.findIndex(
      (l) => l.startS != null && l.endS != null && t >= l.startS && t < l.endS
    );
    if (idx !== -1 && idx !== activeIdx) {
      setActiveIdx(idx);
      lineRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleLineClick(idx: number) {
    const line = data?.script?.[idx];
    if (audioRef.current && line?.startS != null) {
      audioRef.current.currentTime = line.startS;
      audioRef.current.play();
    }
  }

  return (
    <div className="space-y-5">
      {/* Pre / Post selector */}
      <div className="flex gap-2">
        {(["pre", "post"] as PodcastType[]).map((t) => (
          <button
            key={t}
            onClick={() => setPodType(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              podType === t
                ? "bg-teal-600 text-white"
                : "bg-bone-100 text-ink-500 hover:bg-bone-200",
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-ink-500 italic">Cargando…</p>
      ) : !data.exists ? (
        <div className="rounded-xl border border-bone-200 bg-bone-50 p-8 text-center">
          <p className="text-ink-500 font-medium">Podcast {TYPE_LABEL[podType].toLowerCase()} no generado aún</p>
          <p className="text-ink-400 text-sm mt-1">
            Corre{" "}
            <code className="bg-bone-200 px-1 rounded">
              npm run generate:from-pdf -- --slug={slug} --only=podcast
            </code>
          </p>
        </div>
      ) : (
        <>
          {data.audioUrl ? (
            <div className="rounded-xl border border-bone-200 bg-white/70 p-5">
              <audio
                ref={audioRef}
                src={data.audioUrl}
                controls
                preload="auto"
                className="w-full"
                onTimeUpdate={handleTimeUpdate}
              />
              {hasTiming && (
                <p className="text-xs text-ink-400 mt-2 text-center">
                  Toca cualquier línea para saltar a ese punto
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-amber-700 text-sm font-medium">Audio pendiente — guion disponible abajo</p>
            </div>
          )}

          {data.script && (
            <div className="rounded-xl border border-bone-200 bg-white/40 p-5 space-y-2">
              <p className="text-xs uppercase tracking-widest text-ink-400 mb-3">Transcripción</p>
              {data.script.map((line, i) => {
                const isActive = i === activeIdx;
                const clickable = hasTiming && line.startS != null;
                return (
                  <div
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    onClick={() => clickable && handleLineClick(i)}
                    className={cn(
                      "flex gap-3 rounded-lg px-3 py-2 transition-all duration-300",
                      isActive
                        ? cn("border", SPEAKER_BG[line.speaker] ?? "bg-bone-100 border-bone-200", "shadow-sm scale-[1.01]")
                        : "hover:bg-bone-50",
                      clickable && "cursor-pointer",
                    )}
                  >
                    <span className={cn(
                      "font-display text-sm font-medium shrink-0 w-24",
                      SPEAKER_COLOR[line.speaker] ?? "text-ink-500",
                      isActive && "font-bold",
                    )}>
                      {SPEAKER_NAME[line.speaker] ?? line.speaker}
                    </span>
                    <p className={cn(
                      "text-sm leading-relaxed transition-colors",
                      isActive ? "text-ink-900 font-medium" : "text-ink-700",
                    )}>
                      {line.text}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
