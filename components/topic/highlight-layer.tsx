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
type PickerPos = { x: number; y: number; text: string; range: Range };
type DeletePos = { x: number; y: number; id: string };

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
  const [picker, setPicker] = useState<PickerPos | null>(null);
  const [deleter, setDeleter] = useState<DeletePos | null>(null);
  const applied = useRef<Set<string>>(new Set());
  // Keep a ref to highlights so native event handlers always see current value
  const highlightsRef = useRef<Highlight[]>([]);
  const slugRef = useRef(slug);

  useEffect(() => { highlightsRef.current = highlights; }, [highlights]);
  useEffect(() => { slugRef.current = slug; }, [slug]);

  // Load highlights
  useEffect(() => {
    applied.current.clear();
    setHighlights([]);
    fetch(`/api/highlights?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setHighlights(d.items ?? []));
  }, [slug]);

  // Apply saved highlights to DOM
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

  // Native mouseup — most reliable for capturing selection + coordinates
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      const target = e.target as HTMLElement;

      // Inside picker UI — ignore
      if (target.closest("[data-hpicker]")) return;

      // Clicking on an existing mark
      const mark = target.closest("mark[data-hid]") as HTMLElement | null;
      if (mark) {
        setPicker(null);
        setDeleter({ x: e.clientX, y: e.clientY, id: mark.dataset.hid! });
        return;
      }

      // Only react to mouseup inside our container
      const container = containerRef.current;
      if (!container || !container.contains(target)) return;

      setDeleter(null);
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPicker(null); return; }

      const text = sel.toString().trim();
      if (text.length < 2) { setPicker(null); return; }

      const range = sel.getRangeAt(0).cloneRange();
      setPicker({ x: e.clientX, y: e.clientY, text, range });
    }

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [containerRef]);

  // Dismiss on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-hpicker]")) {
        setPicker(null);
        setDeleter(null);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function saveHighlight(color: string) {
    if (!picker) return;
    const { text, range } = picker;
    const id = crypto.randomUUID();

    // Apply mark node-by-node (never restructures DOM)
    const nodes = getTextNodesInRange(range);
    for (const { node, start, end } of nodes) {
      try { wrapTextNode(node, start, end, color, id); } catch { /* skip bad node */ }
    }
    if (nodes.length) applied.current.add(id);

    window.getSelection()?.removeAllRanges();
    setPicker(null);

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
    setDeleter(null);
    const next = highlightsRef.current.filter((h) => h.id !== id);
    highlightsRef.current = next;
    setHighlights(next);

    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slugRef.current, items: next }),
    });
  }

  // Picker appears just below the cursor, clamped to viewport
  function pickerStyle(x: number, y: number) {
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    return {
      left: Math.min(Math.max(x, 90), vw - 90),
      top: y + 14,
      transform: "translateX(-50%)",
    };
  }

  return (
    <>
      {children}

      {picker && (
        <div
          data-hpicker
          className="fixed z-50 flex items-center gap-1.5 p-2 rounded-2xl bg-white shadow-2xl border border-bone-200"
          style={pickerStyle(picker.x, picker.y)}
        >
          {COLORS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => saveHighlight(c.value)}
              className="w-7 h-7 rounded-full border-2 border-white hover:scale-125 active:scale-110 transition shadow-sm"
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      )}

      {deleter && (
        <div
          data-hpicker
          className="fixed z-50 px-3 py-1.5 rounded-xl bg-white shadow-2xl border border-bone-200"
          style={pickerStyle(deleter.x, deleter.y)}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => deleteHighlight(deleter.id)}
            className="flex items-center gap-1.5 text-xs text-rust-600 font-medium hover:text-rust-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Borrar marcador
          </button>
        </div>
      )}
    </>
  );
}

// ── DOM helpers ────────────────────────────────────────────────────────────

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
