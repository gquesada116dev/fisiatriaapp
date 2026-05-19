"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Line = { speaker: "A" | "B"; text: string };
type PodcastData = { exists: boolean; audioUrl?: string; script?: Line[]; durationS?: number };

export function PodcastPane({ slug, topicName }: { slug: string; topicName: string }) {
  const [data, setData] = useState<PodcastData | null>(null);
  const [generating, setGenerating] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(`/api/podcast?slug=${slug}`).then(async (r) => {
      setData(await r.json());
    });
  }, [slug]);

  useEffect(() => {
    if (!data?.audioUrl) return;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: topicName,
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
  }, [data, topicName]);

  async function generate() {
    setGenerating(true);
    const res = await fetch("/api/podcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setGenerating(false);
    if (res.ok) {
      const fresh = await res.json();
      setData({ exists: true, audioUrl: fresh.audioUrl, script: fresh.script });
    }
  }

  if (!data) return <p className="text-ink-500 italic">Cargando…</p>;

  if (!data.exists) {
    return (
      <div className="rounded-xl border border-bone-200 bg-white/60 p-8 text-center">
        <p className="text-ink-700 mb-2 font-display text-xl">Podcast no generado</p>
        <p className="text-ink-500 text-sm mb-5 max-w-md mx-auto">
          Generaremos una conversación entre dos médicos sobre este tema. Tarda 1-2 minutos. Solo se hace una vez.
        </p>
        <button
          onClick={generate}
          disabled={generating}
          className={cn(
            "rounded-md bg-teal-600 text-bone-50 px-5 py-2.5 text-sm hover:bg-teal-700 transition",
            generating && "opacity-60",
          )}
        >
          {generating ? "Generando audio…" : "Generar podcast"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-bone-200 bg-white/70 p-5">
        <audio
          ref={audioRef}
          src={data.audioUrl}
          controls
          preload="metadata"
          className="w-full"
        />
      </div>

      {data.script && (
        <div className="rounded-xl border border-bone-200 bg-white/40 p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-ink-400 mb-2">Transcripción</p>
          {data.script.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={cn(
                  "font-display text-sm font-medium shrink-0 w-16",
                  line.speaker === "A" ? "text-teal-700" : "text-rust-600",
                )}
              >
                {line.speaker === "A" ? "Dra. Marín" : "Dr. Vargas"}
              </span>
              <p className="text-ink-700 text-sm leading-relaxed">{line.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
