"use client";
import { useEffect, useState } from "react";

/**
 * Tiny markdown renderer — enough for Claude's structured output:
 * ##, ###, bullets, bold, code, paragraphs.
 * We avoid pulling react-markdown to keep the bundle lean.
 */
function renderMd(md: string): React.ReactNode[] {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const inline = (s: string): React.ReactNode => {
    // bold, code, inline
    const parts: React.ReactNode[] = [];
    let rest = s;
    let n = 0;
    const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(rest)) !== null) {
      if (m.index > last) parts.push(rest.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`b${n++}`}>{m[2]}</strong>);
      else if (m[3]) parts.push(<code key={`c${n++}`}>{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < rest.length) parts.push(rest.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      out.push(<h2 key={key++}>{line.replace(/^##\s+/, "")}</h2>);
      i++;
    } else if (/^###\s+/.test(line)) {
      out.push(<h3 key={key++}>{line.replace(/^###\s+/, "")}</h3>);
      i++;
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++}>
          {items.map((it, idx) => <li key={idx}>{inline(it)}</li>)}
        </ul>,
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      const paras: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{2,3}\s|[-*]\s)/.test(lines[i])) {
        paras.push(lines[i]);
        i++;
      }
      out.push(<p key={key++}>{inline(paras.join(" "))}</p>);
    }
  }
  return out;
}

export function SummaryPane({ slug }: { slug: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSlug: slug }),
      });
      if (cancelled) return;
      if (!res.ok) {
        setError("No se pudo cargar el resumen.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setContent(data.content_md);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-2/3 rounded bg-bone-200 animate-pulse-soft" />
        <div className="h-4 w-full rounded bg-bone-200 animate-pulse-soft" />
        <div className="h-4 w-5/6 rounded bg-bone-200 animate-pulse-soft" />
        <div className="h-4 w-4/6 rounded bg-bone-200 animate-pulse-soft" />
        <p className="text-xs text-ink-400 mt-4 italic">Generando resumen…</p>
      </div>
    );
  }
  if (error) return <p className="text-rust-600">{error}</p>;
  return <article className="prose-fp max-w-none">{content && renderMd(content)}</article>;
}
