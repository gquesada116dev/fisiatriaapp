"use client";
import { memo, useEffect, useRef, useState } from "react";
import { HighlightLayer } from "./highlight-layer";
import { renderMd } from "@/lib/utils/render-md";


const ArticleContent = memo(function ArticleContent({
  content,
  imageUrl,
  slug,
  articleRef,
}: {
  content: string;
  imageUrl: string | null;
  slug: string;
  articleRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <article ref={articleRef as React.RefObject<HTMLElement>} className="prose-fp max-w-none">
      {imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-bone-200 bg-bone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`Ilustración médica — ${slug}`} className="w-full object-cover max-h-72" />
        </div>
      )}
      {renderMd(content)}
    </article>
  );
});

export function SummaryPane({ slug }: { slug: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);

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
    <HighlightLayer slug={slug} containerRef={articleRef}>
      <ArticleContent content={content!} imageUrl={imageUrl} slug={slug} articleRef={articleRef} />
    </HighlightLayer>
  );
}
