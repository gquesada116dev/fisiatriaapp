"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const COLORS = [
  { value: "#fef08a", label: "Amarillo" },
  { value: "#bbf7d0", label: "Verde" },
  { value: "#bfdbfe", label: "Azul" },
  { value: "#fbcfe8", label: "Rosa" },
  { value: "#e9d5ff", label: "Morado" },
];

type Highlight = { id: string; text: string; color: string };

export function HighlightLayer({
  slug,
  children,
  containerRef,
}: {
  slug: string;
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  // null = nothing selected, object = text is selected and bar should show
  const [selection, setSelection] = useState<{ text: string; range: Range } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const applied = useRef<Set<string>>(new Set());
  const highlightsRef = useRef<Highlight[]>([]);
  const slugRef = useRef(slug);

  useEffect(() => { highlightsRef.current = highlights; }, [highlights]);
  useEffect(() => { slugRef.current = slug; }, [slug]);

  // Load highlights from Firestore
  useEffect(() => {
    applied.current.clear();
    setHighlights([]);
    setSelection(null);
    setDeleteId(null);
    fetch(`/api/highlights?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setHighlights(d.items ?? []));
  }, [slug]);

  // Apply saved highlights to DOM after content renders
  const applyAll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    for (const h of highlights) {
      if (applied.current.has(h.id)) continue;
      if (applyHighlightByText(container, h)) applied.current.add(h.id);
    }
  }, [highlights, containerRef]);

  useEffect(() => {
    const t = setTimeout(applyAll, 150);
    return () => clearTimeout(t);
  }, [applyAll]);

  // selectionchange works on desktop AND mobile (touch selection)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function onSelectionChange() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          setSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const container = containerRef.current;
        // Only show bar if selection is inside our article
        if (!container || !container.contains(range.commonAncestorContainer)) return;
        const text = sel.toString().trim();
        if (text.length < 2) { setSelection(null); return; }
        setSelection({ text, range: range.cloneRange() });
      }, 250);
    }

    document.addEventListener("selectionchange", onSelectionChange);
    return () => { clearTimeout(timer); document.removeEventListener("selectionchange", onSelectionChange); };
  }, [containerRef]);

  // Detect click on existing mark to show delete option
  useEffect(() => {
    function onPointerUp(e: PointerEvent) {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-hid]") as HTMLElement | null;
      if (mark) {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
        setDeleteId(mark.dataset.hid!);
      }
    }
    document.addEventListener("pointerup", onPointerUp);
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, []);

  async function saveHighlight(color: string) {
    if (!selection) return;
    const { text, range } = selection;
    const id = crypto.randomUUID();

    // Apply mark node-by-node — never restructures DOM
    const nodes = getTextNodesInRange(range);
    for (const { node, start, end } of nodes) {
      try { wrapTextNode(node, start, end, color, id); } catch { /* skip node */ }
    }
    if (nodes.length) applied.current.add(id);

    window.getSelection()?.removeAllRanges();
    setSelection(null);

    const item: Highlight = { id, text, color };
    const next = [...highlightsRef.current, item];
    highlightsRef.current = next;
    setHighlights(next);

    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slugRef.current, items: next }),
    });
  }

  async function deleteHighlight(id: string) {
    document.querySelectorAll(`mark[data-hid="${id}"]`).forEach((mark) => {
      const parent = mark.parentNode!;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    applied.current.delete(id);
    setDeleteId(null);

    const next = highlightsRef.current.filter((h) => h.id !== id);
    highlightsRef.current = next;
    setHighlights(next);

    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slugRef.current, items: next }),
    });
  }

  const showBar = selection !== null || deleteId !== null;

  return (
    <>
      {children}

      {/* Sticky bottom bar — appears when text is selected or mark is tapped */}
      <div
        className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-200 ${
          showBar ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {selection && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white shadow-2xl border border-bone-200">
            <span className="text-xs text-ink-400 mr-1">Marcar:</span>
            {COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => saveHighlight(c.value)}
                className="w-8 h-8 rounded-full border-2 border-white hover:scale-125 active:scale-110 transition shadow-sm"
                style={{ backgroundColor: c.value }}
              />
            ))}
            <button
              onClick={() => { window.getSelection()?.removeAllRanges(); setSelection(null); }}
              className="ml-1 w-7 h-7 rounded-full bg-bone-100 text-ink-400 hover:bg-bone-200 flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {deleteId && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white shadow-2xl border border-bone-200">
            <span className="text-xs text-ink-500">Marcador seleccionado</span>
            <button
              onClick={() => deleteHighlight(deleteId)}
              className="flex items-center gap-1.5 text-xs text-rust-600 font-medium hover:text-rust-800 px-3 py-1.5 rounded-lg bg-rust-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Borrar
            </button>
            <button
              onClick={() => setDeleteId(null)}
              className="w-7 h-7 rounded-full bg-bone-100 text-ink-400 hover:bg-bone-200 flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── DOM helpers ──────────────────────────────────────────────────────────────

function getTextNodesInRange(range: Range): { node: Text; start: number; end: number }[] {
  const result: { node: Text; start: number; end: number }[] = [];
  const ancestor =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement!
      : (range.commonAncestorContainer as Element);

  const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.parentElement?.closest("mark[data-hid]")) continue;
    if (!range.intersectsNode(textNode)) continue;
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end = textNode === range.endContainer ? range.endOffset : textNode.length;
    if (start < end) result.push({ node: textNode, start, end });
  }
  return result;
}

function wrapTextNode(node: Text, start: number, end: number, color: string, id: string) {
  const highlighted = node.splitText(start);
  highlighted.splitText(end - start);

  const mark = document.createElement("mark");
  mark.style.backgroundColor = color;
  mark.style.borderRadius = "3px";
  mark.style.padding = "0 2px";
  mark.dataset.hid = id;

  highlighted.parentNode!.insertBefore(mark, highlighted);
  mark.appendChild(highlighted);
}

function applyHighlightByText(container: HTMLElement, h: Highlight): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.parentElement?.closest("mark[data-hid]")) continue;
    const content = textNode.textContent ?? "";
    const idx = content.indexOf(h.text);
    if (idx === -1) continue;
    try {
      wrapTextNode(textNode, idx, idx + h.text.length, h.color, h.id);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
