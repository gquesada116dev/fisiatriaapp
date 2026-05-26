"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Speaker = "A" | "B" | "C";
type PodcastType = "pre" | "post";
type Line = { speaker: Speaker; text: string };
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

const TYPE_LABEL: Record<PodcastType, string> = {
  pre: "Pre-lectura",
  post: "Post-lectura",
};

export function PodcastPane({ slug, topicName }: { slug: string; topicName: string }) {
  const [podType, setPodType] = useState<PodcastType>("pre");
  const [data, setData] = useState<PodcastData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setData(null);
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
              />
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-amber-700 text-sm font-medium">Audio pendiente — guion disponible abajo</p>
            </div>
          )}

          {data.script && (
            <div className="rounded-xl border border-bone-200 bg-white/40 p-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-ink-400 mb-2">Transcripción</p>
              {data.script.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className={cn(
                    "font-display text-sm font-medium shrink-0 w-24",
                    SPEAKER_COLOR[line.speaker] ?? "text-ink-500",
                  )}>
                    {SPEAKER_NAME[line.speaker] ?? line.speaker}
                  </span>
                  <p className="text-ink-700 text-sm leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
