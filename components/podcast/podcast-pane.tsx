"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Line = { speaker: "A" | "B"; text: string };
type PodcastData = { exists: boolean; audioUrl?: string | null; script?: Line[]; durationS?: number };
type PodcastType = "pre" | "post";

const TYPE_LABELS: Record<PodcastType, { label: string; hint: string }> = {
  pre:  { label: "Pre-lectura",  hint: "Antes de estudiar el tema" },
  post: { label: "Post-lectura", hint: "Para repasar después de leer" },
};

export function PodcastPane({ slug, topicName }: { slug: string; topicName: string }) {
  const [type, setType] = useState<PodcastType>("pre");
  const [data, setData] = useState<PodcastData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/podcast?slug=${slug}&type=${type}`).then(async (r) => {
      setData(await r.json());
    });
  }, [slug, type]);

  useEffect(() => {
    if (!data?.audioUrl) return;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${topicName} — ${TYPE_LABELS[type].label}`,
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
  }, [data, topicName, type]);

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex gap-2">
        {(["pre", "post"] as PodcastType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex-1 rounded-xl border px-4 py-3 text-left transition",
              type === t
                ? "border-teal-500 bg-teal-50 text-teal-800"
                : "border-bone-200 bg-white/60 text-ink-500 hover:border-teal-300",
            )}
          >
            <div className="font-medium text-sm">{TYPE_LABELS[t].label}</div>
            <div className="text-xs opacity-70 mt-0.5">{TYPE_LABELS[t].hint}</div>
          </button>
        ))}
      </div>

      {/* Content */}
      {!data && <p className="text-ink-500 italic">Cargando…</p>}

      {data && !data.exists && (
        <div className="rounded-xl border border-bone-200 bg-bone-50 p-8 text-center">
          <p className="text-ink-500 font-medium">Podcast {TYPE_LABELS[type].label} no generado aún</p>
          <p className="text-ink-400 text-sm mt-1">
            Corre <code className="bg-bone-200 px-1 rounded">npm run generate:from-pdf -- --slug={slug} --only=podcast-{type}</code>
          </p>
        </div>
      )}

      {data?.exists && (
        <div className="space-y-5">
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
              <p className="text-amber-700 text-sm font-medium">Guion disponible — audio pendiente de generación</p>
            </div>
          )}

          {data.script && (
            <div className="rounded-xl border border-bone-200 bg-white/40 p-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-ink-400 mb-2">Transcripción</p>
              {data.script.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className={cn(
                    "font-display text-sm font-medium shrink-0 w-20",
                    line.speaker === "A" ? "text-teal-700" : "text-rust-600",
                  )}>
                    {line.speaker === "A" ? "Dr. Marín" : "Dra. Vargas"}
                  </span>
                  <p className="text-ink-700 text-sm leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
