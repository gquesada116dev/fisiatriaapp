"use client";
import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

export function MiniMentor({ slug, topicName }: { slug: string; topicName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const welcome = `Hola Bele! Estoy aquí para ayudarte con **${topicName}**. ¿Qué duda tenés?`;

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    // Prime the first message with topic context if this is the first turn
    const apiMessages: Message[] = next.length === 1
      ? [{ role: "user", content: `Contexto: estoy estudiando "${topicName}". Mi pregunta: ${text}` }]
      : next;

    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text: t } = JSON.parse(data) as { text: string };
            assistantText += t;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: assistantText };
              return updated;
            });
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar con el mentor." }]);
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-bone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-bone-100 bg-bone-50 shrink-0">
        <p className="text-xs font-medium text-ink-500 uppercase tracking-widest">Mentor IA</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {/* Welcome */}
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-teal-700 text-[10px]">M</span>
          </div>
          <div className="bg-bone-50 rounded-xl rounded-tl-none px-3 py-2 text-xs text-ink-700 leading-relaxed max-w-[90%]">
            {renderText(welcome)}
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-teal-700 text-[10px]">M</span>
              </div>
            )}
            <div
              className={`px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[90%] ${
                m.role === "user"
                  ? "bg-teal-600 text-white rounded-tr-none"
                  : "bg-bone-50 text-ink-700 rounded-tl-none"
              }`}
            >
              {m.role === "assistant" ? renderText(m.content) : m.content}
              {i === messages.length - 1 && m.role === "assistant" && streaming && (
                <span className="inline-block w-1 h-3 bg-teal-500 ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 flex gap-2 px-3 py-2 border-t border-bone-100">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Hacé una pregunta…"
          disabled={streaming}
          className="flex-1 text-xs bg-bone-50 border border-bone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded-lg hover:bg-teal-700 disabled:opacity-40 transition shrink-0"
        >
          {streaming ? "…" : "→"}
        </button>
      </div>
    </div>
  );
}

function renderText(text: string): React.ReactNode {
  // Minimal markdown: **bold**, *italic*, newlines
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part === "\n") return <br key={i} />;
    return part;
  });
}
