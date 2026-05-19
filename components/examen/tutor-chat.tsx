"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  question: string;
  options: { letter: string; text: string }[];
  correct: string;
  explanations: Record<string, string>;
  topicName: string;
  onClose: () => void;
};

export function TutorChat({ question, options, correct, explanations, topicName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/examen/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, options, correct, explanations, topicName, history, message: text }),
    });

    if (!res.body) { setLoading(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: accumulated };
        return updated;
      });
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    setLoading(false);
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white border-l border-bone-200 shadow-xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bone-200 bg-bone-50">
        <div>
          <p className="font-display text-teal-700 text-lg">Tutor IA</p>
          <p className="text-xs text-ink-400 truncate max-w-[280px]">{topicName}</p>
        </div>
        <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl leading-none">✕</button>
      </div>

      {/* Context card */}
      <div className="px-4 py-3 border-b border-bone-200 bg-bone-50/60">
        <p className="text-xs text-ink-500 font-medium mb-1">Pregunta</p>
        <p className="text-xs text-ink-700 line-clamp-3">{question}</p>
        <p className="text-xs text-teal-700 mt-1 font-medium">Correcta: {correct}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-ink-400 text-center mb-4">Pregúntame sobre cualquier opción o concepto</p>
            {["¿Por qué las otras opciones están incorrectas?", "Explícame el concepto clave de esta pregunta", "¿Cómo aplica esto en la práctica clínica?"].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="w-full text-left text-xs border border-bone-200 rounded-lg px-3 py-2 text-ink-600 hover:border-teal-400 hover:text-teal-700 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-teal-600 text-white rounded-br-sm"
                  : "bg-bone-100 text-ink-800 border border-bone-200 rounded-bl-sm",
              )}
            >
              {m.content || <span className="opacity-50 animate-pulse">●●●</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-bone-200 bg-bone-50">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Escribe tu pregunta…"
            disabled={loading}
            className="flex-1 border border-bone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-teal-400 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-teal-700 disabled:opacity-40 transition"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
