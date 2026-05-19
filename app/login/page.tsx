"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/";
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setLoading(false);
    if (res.ok) router.push(next);
    else setErr("Contraseña incorrecta");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-10 text-center">
          <p className="font-display text-5xl text-teal-700 tracking-tight">FisiaPrep</p>
          <p className="text-ink-500 mt-2 text-sm italic">Camino al CENARE</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-lg border border-bone-200 bg-white/70 px-4 py-3 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          />
          {err && <p className="text-rust-600 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-600 text-bone-50 py-3 font-medium hover:bg-teal-700 transition disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
