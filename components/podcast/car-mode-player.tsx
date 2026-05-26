"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ScriptLine = { speaker: string; text: string; startS?: number; endS?: number };
type Track = { slug: string; name: string; category: string; url: string; script: ScriptLine[] };

const SPEAKER_NAME: Record<string, string> = {
  A: "Dr. Marín",
  B: "Dra. Vargas",
  C: "Presentadora",
};

export function CarModePlayer({ tracks }: { tracks: Track[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = tracks[idx];
  const hasTiming = current?.script?.some((l) => l.startS != null) ?? false;
  const activeLine = hasTiming && activeLineIdx >= 0 ? current.script[activeLineIdx] : null;
  const prevLine = hasTiming && activeLineIdx > 0 ? current.script[activeLineIdx - 1] : null;
  const nextLine = hasTiming && activeLineIdx >= 0 && activeLineIdx < current.script.length - 1
    ? current.script[activeLineIdx + 1]
    : null;

  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: "FisiaPrep — Modo Carro",
      album: current.category,
    });
    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (audioRef.current) audioRef.current.currentTime += 30;
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (audioRef.current) audioRef.current.currentTime -= 15;
    });
  }, [idx, current]);

  useEffect(() => {
    setActiveLineIdx(-1);
  }, [idx]);

  useEffect(() => {
    if (playing && audioRef.current) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [idx, playing]);

  function next() { setIdx((i) => Math.min(i + 1, tracks.length - 1)); }
  function prev() { setIdx((i) => Math.max(0, i - 1)); }

  function onEnded() {
    if (idx < tracks.length - 1) setIdx((i) => i + 1);
    else setPlaying(false);
  }

  function handleTimeUpdate() {
    if (!hasTiming || !audioRef.current || !current.script) return;
    const t = audioRef.current.currentTime;
    const i = current.script.findIndex(
      (l) => l.startS != null && l.endS != null && t >= l.startS && t < l.endS
    );
    if (i !== -1 && i !== activeLineIdx) setActiveLineIdx(i);
  }

  if (!tracks.length) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-display text-3xl text-ink-900 mb-3">Sin podcasts generados</p>
          <p className="text-ink-500 mb-6">Genera podcasts en cada tema para poder usarlos en Modo Carro.</p>
          <Link href="/" className="text-teal-700 underline">Volver a temas</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink-900 text-bone-100 flex flex-col select-none">
      <header className="p-6 flex justify-between items-center shrink-0">
        <Link href="/" className="text-bone-200/60 text-sm hover:text-bone-100">← Salir</Link>
        <p className="font-display text-bone-200/80 tracking-widest text-xs uppercase">Modo Carro</p>
        <span className="text-bone-200/60 text-sm">{idx + 1} / {tracks.length}</span>
      </header>

      {/* Center content */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-hidden">

        {hasTiming ? (
          /* Synchronized lyrics view — visible from the start */
          <div className="w-full max-w-2xl space-y-6">
            {/* Prev line */}
            <p className="text-bone-200/30 text-lg md:text-xl leading-relaxed transition-all duration-500 line-clamp-2">
              {prevLine?.text ?? ""}
            </p>

            {/* Active line (or title before playback starts) */}
            <div className="space-y-2">
              <p className="text-bone-200/50 text-xs uppercase tracking-widest">
                {activeLine ? (SPEAKER_NAME[activeLine.speaker] ?? activeLine.speaker) : current.category}
              </p>
              <p className="text-bone-50 text-2xl md:text-3xl font-display leading-snug transition-all duration-500">
                {activeLine ? activeLine.text : current.name}
              </p>
            </div>

            {/* Next line */}
            <p className="text-bone-200/30 text-lg md:text-xl leading-relaxed transition-all duration-500 line-clamp-2">
              {nextLine?.text ?? ""}
            </p>
          </div>
        ) : (
          /* No timing data — just show topic name */
          <>
            <p className="text-bone-200/50 uppercase tracking-widest text-xs mb-3">{current.category}</p>
            <h1 className="font-display text-4xl md:text-6xl text-bone-50 max-w-3xl leading-tight">
              {current.name}
            </h1>
          </>
        )}

        <audio
          ref={audioRef}
          src={current.url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={onEnded}
          onTimeUpdate={handleTimeUpdate}
          preload="auto"
        />

        {/* Controls */}
        <div className="mt-12 flex items-center justify-center gap-8 md:gap-12">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="w-20 h-20 rounded-full border-2 border-bone-200/30 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
            aria-label="Anterior"
          >
            <SkipBackIcon />
          </button>

          <button
            onClick={() => {
              if (!audioRef.current) return;
              if (audioRef.current.paused) audioRef.current.play();
              else audioRef.current.pause();
            }}
            className="w-28 h-28 rounded-full bg-teal-500 text-bone-50 flex items-center justify-center active:scale-95 transition shadow-2xl shadow-teal-500/30"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={next}
            disabled={idx === tracks.length - 1}
            className="w-20 h-20 rounded-full border-2 border-bone-200/30 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
            aria-label="Siguiente"
          >
            <SkipForwardIcon />
          </button>
        </div>

        <button
          onClick={() => { if (audioRef.current) audioRef.current.currentTime += 30; }}
          className="mt-8 text-bone-200/50 text-sm hover:text-bone-200/80"
        >
          +30s
        </button>
      </section>
    </main>
  );
}

const PlayIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>
);
const SkipBackIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
);
const SkipForwardIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6h2v12h-2z"/></svg>
);
