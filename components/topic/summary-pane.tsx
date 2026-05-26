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
    } else if (/^####\s+/.test(line)) {
      out.push(<h4 key={key++}>{line.replace(/^####\s+/, "")}</h4>);
      i++;
    } else if (/^###\s+/.test(line)) {
      out.push(<h3 key={key++}>{line.replace(/^###\s+/, "")}</h3>);
      i++;
    } else if (/^!\[/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (m) {
        // eslint-disable-next-line @next/next/no-img-element
        out.push(<img key={key++} src={m[2]} alt={m[1]} className="w-full max-h-80 object-contain rounded-xl border border-bone-200 my-4" />);
      }
      i++;
    } else if (/^\|/.test(line)) {
      // Markdown table — collect all | lines
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      // Row 1 = header, row 2 = separator (skip), rest = body
      const [head, , ...body] = rows;
      out.push(
        <div key={key++} className="overflow-x-auto my-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {head?.map((cell, ci) => (
                  <th key={ci} className="border border-bone-300 bg-bone-100 px-3 py-1.5 text-left font-semibold text-ink-800">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-bone-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-bone-200 px-3 py-1.5 text-ink-700">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
      if (!data.exists) {
        setError("not_generated");
        setLoading(false);
        return;
      }
      setContent(data.content_md);
      setImageUrl(data.imageUrl ?? null);
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
      </div>
    );
  }
  if (error === "not_generated") {
    return (
      <div className="rounded-xl border border-bone-200 bg-bone-50 p-8 text-center">
        <p className="text-ink-500 font-medium">Resumen no generado aún</p>
        <p className="text-ink-400 text-sm mt-1">Corre <code className="bg-bone-200 px-1 rounded">npm run generate:from-pdf -- --slug={slug}</code></p>
      </div>
    );
  }
  if (error) return <p className="text-rust-600">{error}</p>;
  return (
    <article className="prose-fp max-w-none">
      {imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-bone-200 bg-bone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Ilustración médica — ${slug}`}
            className="w-full object-cover max-h-72"
          />
        </div>
      )}
      {content && renderMd(content)}
    </article>
  );
}
