"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Minimum 44px touch targets on mobile/tablet
const isTouchDevice = () =>
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

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
  // Bounding rect of the current selection or tapped mark — used to position the bar above it
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const applied = useRef<Set<string>>(new Set());
  const highlightsRef = useRef<Highlight[]>([]);
  const slugRef = useRef(slug);
  // Track touch start position to distinguish taps from drags
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { highlightsRef.current = highlights; }, [highlights]);
  useEffect(() => { slugRef.current = slug; }, [slug]);

  useEffect(() => {
    applied.current.clear();
    setHighlights([]);
    setSelection(null);
    setDeleteId(null);
    setAnchorRect(null);
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
    setAnchorRect(range.getBoundingClientRect());
    setSelection({ text, range: range.cloneRange() });
  }

  function handleMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // Click on existing mark → show delete
    const mark = target.closest("mark[data-hid]") as HTMLElement | null;
    if (mark) {
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      setAnchorRect(mark.getBoundingClientRect());
      setDeleteId(mark.dataset.hid!);
      return;
    }
    setDeleteId(null);
    readSelection();
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    const touch = e.changedTouches[0];
    touchStartRef.current = null;

    // Detect a tap (finger didn't move much)
    const wasTap =
      start &&
      Math.abs(touch.clientX - start.x) < 10 &&
      Math.abs(touch.clientY - start.y) < 10;

    if (wasTap) {
      // Use coordinates to reliably find if the user tapped an existing mark
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const mark = el?.closest("mark[data-hid]") as HTMLElement | null;
      if (mark) {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
        setAnchorRect(mark.getBoundingClientRect());
        setDeleteId(mark.dataset.hid!);
        return;
      }
    }

    setDeleteId(null);
    // Selection isn't finalized at touchend on tablets — wait for native handles to settle
    setTimeout(readSelection, 300);
  }

  function dismiss() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setDeleteId(null);
    setAnchorRect(null);
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
  const touch = isTouchDevice();
  const btnSize = touch ? 44 : 28;
  const closeSize = touch ? 40 : 26;

  // Position the bar above the selection/mark; flip below if too close to top of viewport
  function computeBarPosition(rect: DOMRect): Pick<React.CSSProperties, "top" | "left"> {
    const BAR_H = touch ? 68 : 52;
    const BAR_W = touch ? 340 : 280;
    const GAP = 10;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;

    const preferredTop = rect.top - BAR_H - GAP;
    const top = preferredTop >= 8 ? preferredTop : rect.bottom + GAP;

    const centerX = rect.left + rect.width / 2;
    const left = Math.max(8, Math.min(centerX - BAR_W / 2, vw - BAR_W - 8));

    return { top, left };
  }

  const barPosition = anchorRect ? computeBarPosition(anchorRect) : { top: -9999, left: -9999 };

  const barStyle: React.CSSProperties = {
    position: "fixed",
    ...barPosition,
    zIndex: 50,
    display: showBar ? "flex" : "none",
    alignItems: "center",
    gap: touch ? 12 : 8,
    padding: touch ? "12px 20px" : "10px 16px",
    borderRadius: 24,
    background: "white",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)",
    border: "1px solid #e8e2d9",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <div onMouseUp={handleMouseUp} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
                  width: btnSize, height: btnSize, borderRadius: "50%",
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
                width: closeSize, height: closeSize, borderRadius: "50%",
                background: "#f2ede6", border: "none",
                color: "#9e9589", cursor: "pointer",
                fontSize: touch ? 16 : 14, marginLeft: 2,
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
                fontSize: touch ? 14 : 12, color: "#c0392b", fontWeight: 600,
                padding: touch ? "10px 16px" : "6px 12px", borderRadius: 10,
                background: "#fff5f5", border: "1px solid #fecaca",
                cursor: "pointer",
                minHeight: touch ? 44 : undefined,
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
                width: closeSize, height: closeSize, borderRadius: "50%",
                background: "#f2ede6", border: "none",
                color: "#9e9589", cursor: "pointer",
                fontSize: touch ? 16 : 14,
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
  // Collect all unhighlighted text nodes upfront
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const allNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (!t.parentElement?.closest("mark[data-hid]")) allNodes.push(t);
  }

  // 1. Single-node match (most common case)
  for (const t of allNodes) {
    const content = t.textContent ?? "";
    const idx = content.indexOf(h.text);
    if (idx !== -1) {
      try { wrapTextNode(t, idx, idx + h.text.length, h.color, h.id); return true; }
      catch { return false; }
    }
  }

  // 2. Multi-node match — handles selections that cross element boundaries
  //    (e.g. "bold text and normal" where "bold" is inside <strong>)
  for (let i = 0; i < allNodes.length; i++) {
    let combined = "";
    const segment: Array<{ node: Text; nodeStart: number; len: number }> = [];
    for (let j = i; j < allNodes.length; j++) {
      const len = allNodes[j].textContent?.length ?? 0;
      segment.push({ node: allNodes[j], nodeStart: combined.length, len });
      combined += allNodes[j].textContent ?? "";
      if (combined.length >= h.text.length + 200) break;
    }
    const matchIdx = combined.indexOf(h.text);
    if (matchIdx === -1) continue;
    const matchEnd = matchIdx + h.text.length;
    let wrapped = 0;
    for (const { node: t, nodeStart, len } of segment) {
      const s = Math.max(0, matchIdx - nodeStart);
      const e = Math.min(len, matchEnd - nodeStart);
      if (s < e) {
        try { wrapTextNode(t, s, e, h.color, h.id); wrapped++; }
        catch { /* skip */ }
      }
    }
    if (wrapped > 0) return true;
  }

  return false;
}
