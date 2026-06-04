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
type PickerPos = { x: number; y: number; text: string };
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
      if (applyHighlightToDOM(container, h)) applied.current.add(h.id);
    }
  }, [highlights, containerRef]);

  useEffect(() => {
    const t = setTimeout(applyAll, 120);
    return () => clearTimeout(t);
  }, [applyAll]);

  function handleMouseUp(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const mark = target.closest("mark[data-hid]") as HTMLElement | null;
    if (mark) {
      const rect = mark.getBoundingClientRect();
      setDeleter({ x: rect.left + rect.width / 2, y: rect.top, id: mark.dataset.hid! });
      setPicker(null);
      return;
    }
    setDeleter(null);

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setPicker(null); return; }
    const text = sel.toString().trim();
    if (text.length < 2) { setPicker(null); return; }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPicker({ x: rect.left + rect.width / 2, y: rect.top, text });
  }

  async function saveHighlight(color: string) {
    if (!picker) return;
    const id = crypto.randomUUID();
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
    const mark = document.querySelector(`mark[data-hid="${id}"]`);
    if (mark) {
      const parent = mark.parentNode!;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    }
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

function applyHighlightToDOM(container: HTMLElement, h: Highlight): boolean {
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
      const range = document.createRange();
      range.setStart(textNode, idx);
      range.setEnd(textNode, idx + h.text.length);
      const mark = document.createElement("mark");
      mark.style.backgroundColor = h.color;
      mark.style.borderRadius = "3px";
      mark.style.padding = "0 2px";
      mark.dataset.hid = h.id;
      range.surroundContents(mark);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
