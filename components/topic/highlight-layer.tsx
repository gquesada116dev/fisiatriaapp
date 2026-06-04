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

  useEffect(() => {
    setHighlights([]);
    applied.current.clear();
    fetch(`/api/highlights?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setHighlights(d.items ?? []));
  }, [slug]);

  const applyAll = useCallback(() => {
    const container = containerRef.current;
    if (!container || !highlights.length) return;
    for (const h of highlights) {
      if (applied.current.has(h.id)) continue;
      if (applyHighlightByText(container, h)) applied.current.add(h.id);
    }
  }, [highlights, containerRef]);

  useEffect(() => {
    const t = setTimeout(applyAll, 120);
    return () => clearTimeout(t);
  }, [applyAll]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-hpicker]")) {
        setPicker(null);
        setDeleter(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function handleMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-hpicker]")) return;

    const mark = target.closest("mark[data-hid]") as HTMLElement | null;
    if (mark) {
      setDeleter({ x: e.clientX, y: e.clientY, id: mark.dataset.hid! });
      setPicker(null);
      return;
    }

    setDeleter(null);
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setPicker(null); return; }
    const text = sel.toString().trim();
    if (text.length < 2) { setPicker(null); return; }

    const range = sel.getRangeAt(0).cloneRange();
    // Use mouse position — range.getBoundingClientRect() returns {0,0} in complex elements
    setPicker({ x: e.clientX, y: e.clientY, text, range });
  }

  async function saveHighlight(color: string) {
    if (!picker) return;
    const id = crypto.randomUUID();

    // Apply mark node-by-node — never restructures the DOM
    const nodes = getTextNodesInRange(picker.range);
    for (const { node, start, end } of nodes) {
      wrapTextNode(node, start, end, color, id);
    }
    if (nodes.length) applied.current.add(id);

    const item: Highlight = { id, text: picker.text, color };
    const next = [...highlights, item];
    setHighlights(next);
    setPicker(null);
    window.getSelection()?.removeAllRanges();

    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, items: next }),
    });
  }

  async function deleteHighlight(id: string) {
    document.querySelectorAll(`mark[data-hid="${id}"]`).forEach((mark) => {
      const parent = mark.parentNode!;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    applied.current.delete(id);
    const next = highlights.filter((h) => h.id !== id);
    setHighlights(next);
    setDeleter(null);

    await fetch("/api/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, items: next }),
    });
  }

  return (
    <div onMouseUp={handleMouseUp}>
      {children}

      {picker && (
        <div
          data-hpicker
          className="fixed z-50 flex items-center gap-1.5 p-2 rounded-2xl bg-white shadow-2xl border border-bone-200"
          style={{ left: picker.x, top: picker.y - 56, transform: "translateX(-50%)" }}
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
          style={{ left: deleter.x, top: deleter.y - 46, transform: "translateX(-50%)" }}
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
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
  // Split the text node into [before | marked | after] without touching the DOM structure
  const before = node.splitText(start);
  const after = before.splitText(end - start);
  void after; // kept in place by splitText

  const mark = document.createElement("mark");
  mark.style.backgroundColor = color;
  mark.style.borderRadius = "3px";
  mark.style.padding = "0 2px";
  mark.dataset.hid = id;
  before.parentNode!.insertBefore(mark, before);
  mark.appendChild(before);
}

// Restore highlights from Firestore by searching in plain text nodes
function applyHighlightByText(container: HTMLElement, h: Highlight): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node.parentElement as HTMLElement)?.closest("mark[data-hid]")) continue;
    nodes.push(node as Text);
  }

  for (const textNode of nodes) {
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
