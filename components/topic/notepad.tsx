"use client";
import { useEffect, useRef, useState } from "react";

const HIGHLIGHT_COLORS = [
  { value: "#fef08a", label: "Amarillo" },
  { value: "#bbf7d0", label: "Verde" },
  { value: "#bfdbfe", label: "Azul" },
  { value: "#fbcfe8", label: "Rosa" },
  { value: "#e9d5ff", label: "Morado" },
];

export function Notepad({ slug }: { slug: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    fetch(`/api/notes?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (editorRef.current) {
          editorRef.current.innerHTML = d.htmlContent || "<p><br></p>";
          setLoaded(true);
        }
      });
    return () => clearTimeout(saveTimer.current);
  }, [slug]);

  async function save() {
    setStatus("saving");
    const htmlContent = editorRef.current?.innerHTML ?? "";
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, htmlContent }),
    });
    setStatus("saved");
  }

  function handleInput() {
    setStatus("unsaved");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1500);
  }

  function fmt(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }

  function clearFormat() {
    document.execCommand("removeFormat");
    document.execCommand("unlink");
    editorRef.current?.focus();
    handleInput();
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-bone-200 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-bone-100 bg-bone-50 flex-wrap">
        <span className="text-xs text-ink-400 mr-1 font-medium">Notas</span>
        <div className="w-px h-4 bg-bone-200 mx-1" />

        <ToolBtn onClick={() => fmt("bold")} title="Negrita">
          <strong>B</strong>
        </ToolBtn>
        <ToolBtn onClick={() => fmt("italic")} title="Cursiva">
          <em>I</em>
        </ToolBtn>
        <ToolBtn onClick={() => fmt("underline")} title="Subrayado">
          <span className="underline">U</span>
        </ToolBtn>

        <div className="w-px h-4 bg-bone-200 mx-1" />

        <ToolBtn onClick={() => fmt("insertUnorderedList")} title="Lista">
          ≡
        </ToolBtn>
        <ToolBtn onClick={() => fmt("insertOrderedList")} title="Lista numerada">
          1.
        </ToolBtn>

        <div className="w-px h-4 bg-bone-200 mx-1" />

        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.value}
            title={`Resaltar ${c.label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => fmt("backColor", c.value)}
            className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-125 transition"
            style={{ backgroundColor: c.value }}
          />
        ))}

        <div className="w-px h-4 bg-bone-200 mx-1" />

        <ToolBtn onClick={clearFormat} title="Limpiar formato">
          ✕
        </ToolBtn>

        <div className="ml-auto flex items-center gap-2">
          {status === "unsaved" && (
            <button
              onClick={save}
              className="text-xs text-teal-600 hover:text-teal-800 font-medium px-2 py-0.5 rounded bg-teal-50 border border-teal-100"
            >
              Guardar
            </button>
          )}
          <span className="text-xs text-ink-400">
            {status === "saved" ? "✓ Guardado" : status === "saving" ? "Guardando…" : ""}
          </span>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={loaded}
        suppressContentEditableWarning
        onInput={handleInput}
        className="flex-1 overflow-y-auto p-4 text-sm text-ink-800 leading-relaxed focus:outline-none"
        style={{
          minHeight: 0,
          fontFamily: "inherit",
        }}
        data-placeholder="Empieza a escribir tus notas aquí…"
      />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #b8a99a;
          pointer-events: none;
        }
        [contenteditable] ul { list-style: disc; padding-left: 1.5rem; margin: 0.25rem 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.5rem; margin: 0.25rem 0; }
        [contenteditable] p { margin: 0.25rem 0; }
        [contenteditable] b, [contenteditable] strong { font-weight: 700; }
        [contenteditable] i, [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
      `}</style>
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded text-xs text-ink-600 hover:bg-bone-200 transition"
    >
      {children}
    </button>
  );
}
