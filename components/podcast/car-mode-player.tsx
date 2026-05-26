"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type ScriptLine = { speaker: string; text: string; startS?: number; endS?: number };
type Track = { slug: string; name: string; category: string; url: string; script: ScriptLine[]; podType: string };

const SPEAKER_NAME: Record<string, string> = {
  A: "Dr. Marín",
  B: "Dra. Vargas",
  C: "Presentadora",
};

const TYPE_LABEL: Record<string, string> = {
  pre: "Pre-lectura",
  post: "Post-lectura",
};

export function CarModePlayer({ tracks }: { tracks: Track[] }) {
  const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [activeLineIdx, setActiveLineIdx] = useState(-1);
  const [speedIdx, setSpeedIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = selectedIdx !== null ? tracks[selectedIdx] : null;
  const hasTiming = current?.script?.some((l) => l.startS != null) ?? false;
  const displayIdx = hasTiming && activeLineIdx < 0 ? 0 : activeLineIdx;
  const activeLine = hasTiming && displayIdx >= 0 ? current!.script[displayIdx] : null;
  const prevLine = hasTiming && displayIdx > 0 ? current!.script[displayIdx - 1] : null;
  const nextLine = hasTiming && displayIdx >= 0 && displayIdx < current!.script.length - 1
    ? current!.script[displayIdx + 1]
    : null;

  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${current.name} — ${TYPE_LABEL[current.podType] ?? current.podType}`,
      artist: "FisiaPrep — Modo Carro",
      album: current.category,
    });
    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (audioRef.current) audioRef.current.currentTime += 30;
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (audioRef.current) audioRef.current.currentTime -= 15;
    });
  }, [selectedIdx, current]);

  useEffect(() => {
    setActiveLineIdx(-1);
    setSpeedIdx(0);
    if (playing && audioRef.current) {
      audioRef.current.play().catch(() => setPlaying(false));
    }
  }, [selectedIdx]);

  function handleTimeUpdate() {
    if (!hasTiming || !audioRef.current || !current?.script) return;
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

  // ── Track selector ────────────────────────────────────────────────────────
  if (selectedIdx === null) {
    const grouped = tracks.reduce<Record<string, Track[]>>((acc, t) => {
      (acc[t.category] ??= []).push(t);
      return acc;
    }, {});

    return (
      <main className="min-h-screen bg-ink-900 text-bone-100 flex flex-col">
        <header className="p-6 flex justify-between items-center shrink-0">
          <Link href="/" className="text-bone-200/60 text-sm hover:text-bone-100">← Salir</Link>
          <p className="font-display text-bone-200/80 tracking-widest text-xs uppercase">Modo Carro</p>
          <span className="w-12" />
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-8">
          <p className="text-bone-200/50 text-center text-sm">¿Qué quieres escuchar?</p>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-bone-200/40 uppercase tracking-widest text-xs mb-3">{category}</p>
              <div className="space-y-2">
                {items.map((t, i) => {
                  const globalIdx = tracks.indexOf(t);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(globalIdx)}
                      className="w-full text-left px-5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition border border-white/10"
                    >
                      <p className="text-bone-50 font-display text-lg leading-snug">{t.name}</p>
                      <p className="text-bone-200/40 text-xs mt-1">{TYPE_LABEL[t.podType] ?? t.podType}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── Player ────────────────────────────────────────────────────────────────
  if (!current) return null;
  return (
    <main className="min-h-screen bg-ink-900 text-bone-100 flex flex-col select-none">
      <header className="p-6 flex justify-between items-center shrink-0">
        <button
          onClick={() => { audioRef.current?.pause(); setSelectedIdx(null); setPlaying(false); }}
          className="text-bone-200/60 text-sm hover:text-bone-100"
        >
          ← Temas
        </button>
        <p className="font-display text-bone-200/80 tracking-widest text-xs uppercase">Modo Carro</p>
        <span className="w-12" />
      </header>

      <audio
        ref={audioRef}
        src={current.url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
      />

      {/* Controls — pinned below header */}
      <div className="shrink-0 flex flex-col items-center gap-4 pt-2 pb-6 px-6">
        <div className="flex items-center justify-center gap-8 md:gap-12">
          <button
            onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 15; }}
            className="w-16 h-16 rounded-full border-2 border-bone-200/30 flex items-center justify-center active:scale-95 transition"
            aria-label="-15s"
          >
            <RewindIcon />
          </button>

          <button
            onClick={() => {
              if (!audioRef.current) return;
              if (audioRef.current.paused) audioRef.current.play();
              else audioRef.current.pause();
            }}
            className="w-24 h-24 rounded-full bg-teal-500 text-bone-50 flex items-center justify-center active:scale-95 transition shadow-2xl shadow-teal-500/30"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={() => { if (audioRef.current) audioRef.current.currentTime += 30; }}
            className="w-16 h-16 rounded-full border-2 border-bone-200/30 flex items-center justify-center active:scale-95 transition"
            aria-label="+30s"
          >
            <ForwardIcon />
          </button>
        </div>

        <button
          onClick={() => {
            const next = (speedIdx + 1) % SPEEDS.length;
            setSpeedIdx(next);
            if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
          }}
          className="px-4 py-1.5 rounded-full border border-bone-200/30 text-bone-200/70 text-sm font-medium hover:border-bone-200/60 hover:text-bone-200 transition"
        >
          {SPEEDS[speedIdx]}×
        </button>
      </div>

      {/* Lyrics — fills remaining space */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center overflow-hidden pb-10">
        {hasTiming ? (
          <div className="w-full max-w-2xl space-y-6">
            <p className="text-bone-200/30 text-lg md:text-xl leading-relaxed transition-all duration-500 line-clamp-2">
              {prevLine?.text ?? ""}
            </p>
            <div className="space-y-2">
              <p className="text-bone-200/50 text-xs uppercase tracking-widest">
                {activeLine ? (SPEAKER_NAME[activeLine.speaker] ?? activeLine.speaker) : current.category}
              </p>
              <p className="text-bone-50 text-2xl md:text-3xl font-display leading-snug transition-all duration-500">
                {activeLine ? activeLine.text : current.name}
              </p>
            </div>
            <p className="text-bone-200/30 text-lg md:text-xl leading-relaxed transition-all duration-500 line-clamp-2">
              {nextLine?.text ?? ""}
            </p>
          </div>
        ) : (
          <>
            <p className="text-bone-200/50 uppercase tracking-widest text-xs mb-3">{current.category}</p>
            <h1 className="font-display text-4xl md:text-6xl text-bone-50 max-w-3xl leading-tight">
              {current.name}
            </h1>
          </>
        )}
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
const RewindIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
  </svg>
);
const ForwardIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
  </svg>
);
