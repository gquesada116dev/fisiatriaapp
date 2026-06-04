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
  const [selection, setSelection] = useState<{ text: string; range: Range } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const applied = useRef<Set<string>>(new Set());
  const highlightsRef = useRef<Highlight[]>([]);
  const slugRef = useRef(slug);

  useEffect(() => { highlightsRef.current = highlights; }, [highlights]);
  useEffect(() => { slugRef.current = slug; }, [slug]);

  useEffect(() => {
    applied.current.clear();
    setHighlights([]);
    setSelection(null);
    setDeleteId(null);
    fetch(`/api/highlights?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setHighlights(d.items ?? []));
  }, [slug]);

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

  function readSelection() {
    const sel = window.getSelection();
    if (!sel || sel.type !== "Range" || !sel.rangeCount) { setSelection(null); return; }
    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    const text = sel.toString().trim();
    if (text.length < 2) { setSelection(null); return; }
    setSelection({ text, range: range.cloneRange() });
  }

  function handleMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // Click on existing mark → show delete
    const mark = target.closest("mark[data-hid]") as HTMLElement | null;
    if (mark) {
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      setDeleteId(mark.dataset.hid!);
      return;
    }
    setDeleteId(null);
    readSelection();
  }

  function handleTouchEnd() {
    // Selection isn't finalized at touchend — wait one tick
    setTimeout(() => {
      const target = document.activeElement as HTMLElement | null;
      const mark = target?.closest("mark[data-hid]") as HTMLElement | null;
      if (mark) {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
        setDeleteId(mark.dataset.hid!);
        return;
      }
      setDeleteId(null);
      readSelection();
    }, 50);
  }

  function dismiss() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setDeleteId(null);
  }

  async function saveHighlight(color: string) {
    if (!selection) return;
    const { text, range } = selection;
    const id = crypto.randomUUID();

    const nodes = getTextNodesInRange(range);
    for (const { node, start, end } of nodes) {
      try { wrapTextNode(node, start, end, color, id); } catch { /* skip */ }
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

  // Inline styles avoid Tailwind purging + transform conflicts
  const barStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 50,
    display: showBar ? "flex" : "none",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 20,
    background: "white",
    boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
    border: "1px solid #e8e2d9",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <div onMouseUp={handleMouseUp} onTouchEnd={handleTouchEnd}>
        {children}
      </div>

      <div style={barStyle}>
        {selection && (
          <>
            <span style={{ fontSize: 12, color: "#9e9589", marginRight: 2 }}>Marcar:</span>
            {COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => saveHighlight(c.value)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  backgroundColor: c.value,
                  border: "2px solid white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
            ))}
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={dismiss}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "#f2ede6", border: "none",
                color: "#9e9589", cursor: "pointer",
                fontSize: 14, marginLeft: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </>
        )}

        {deleteId && (
          <>
            <span style={{ fontSize: 12, color: "#9e9589" }}>Marcador:</span>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => deleteHighlight(deleteId)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "#c0392b", fontWeight: 600,
                padding: "6px 12px", borderRadius: 10,
                background: "#fff5f5", border: "1px solid #fecaca",
                cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Borrar
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setDeleteId(null)}
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "#f2ede6", border: "none",
                color: "#9e9589", cursor: "pointer",
                fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>
          </>
        )}
      </div>
    </>
  );
}

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
    } catch { return false; }
  }
  return false;
}
