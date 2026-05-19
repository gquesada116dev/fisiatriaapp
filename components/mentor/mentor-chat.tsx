"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Send, Plus, MessageSquare, ChevronLeft } from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Session = { id: string; title: string; updatedAt: string | null };

const STARTERS = [
  "Hacéme una pregunta de ACV",
  "Dame un caso clínico de lesión medular",
  "Flashcards sobre la escala ASIA",
  "Explicame la rehabilitación cardiopulmonar",
  "¿Qué temas debo priorizar para el examen?",
  "Dame un caso de manejo del dolor",
];

function renderContent(text: string) {
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let key = 0;

  const inline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let n = 0;
    const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[1]) parts.push(<strong key={`b${n++}`}>{m[2]}</strong>);
      else if (m[3]) parts.push(<code key={`c${n++}`} className="bg-bone-200 px-1 rounded text-xs">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "---") {
      out.push(<hr key={key++} className="border-bone-300 my-3" />);
      i++;
    } else if (line.startsWith("🃏")) {
      out.push(
        <div key={key++} className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 my-2">
          <p className="text-teal-800 text-sm">{inline(line)}</p>
        </div>,
      );
      i++;
    } else if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)![1].length;
      const text = line.replace(/^#+\s/, "");
      const cls = level === 1 ? "text-lg font-semibold text-ink-900 mt-3 mb-1" :
                  level === 2 ? "text-base font-semibold text-ink-800 mt-2 mb-1" :
                                "text-sm font-semibold text-ink-700 mt-2";
      out.push(<p key={key++} className={cls}>{text}</p>);
      i++;
    } else if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="list-disc ml-4 space-y-0.5 my-1">
          {items.map((it, idx) => <li key={idx} className="text-sm">{inline(it)}</li>)}
        </ul>,
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      const paras: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|[-*]\s|---)/.test(lines[i])) {
        paras.push(lines[i]);
        i++;
      }
      out.push(<p key={key++} className="text-sm leading-relaxed">{inline(paras.join(" "))}</p>);
    }
  }
  return out;
}

export function MentorChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadSessions() {
    const res = await fetch("/api/mentor/sessions");
    if (res.ok) setSessions((await res.json()).sessions ?? []);
  }

  async function openSession(id: string) {
    const res = await fetch(`/api/mentor/sessions?id=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSessionId(id);
    setMessages(data.messages ?? []);
    setShowSidebar(false);
  }

  function newChat() {
    setSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    inputRef.current?.focus();
  }

  async function saveSession(msgs: Message[], id: string) {
    const title = msgs.find((m) => m.role === "user")?.content.slice(0, 70) ?? "Nueva sesión";
    await fetch("/api/mentor/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title, messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
    });
    loadSessions();
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");

    const currentSessionId = sessionId ?? crypto.randomUUID();
    if (!sessionId) setSessionId(currentSessionId);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setStreaming(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);
    let assistantContent = "";

    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            assistantContent += JSON.parse(payload).text ?? "";
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
            );
          } catch {}
        }
      }
    } catch (e) {
      assistantContent = "Error al conectar con el mentor. Intentá de nuevo.";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m)),
      );
    } finally {
      setStreaming(false);
      const finalMessages = [
        ...nextMessages,
        { id: assistantId, role: "assistant" as const, content: assistantContent },
      ];
      await saveSession(finalMessages, currentSessionId);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "w-64 shrink-0 border-r border-bone-200 bg-bone-50 flex flex-col transition-transform duration-200",
        "absolute inset-y-0 left-0 z-30 md:relative md:translate-x-0",
        showSidebar ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="p-3 border-b border-bone-200">
          <button
            onClick={newChat}
            className="w-full flex items-center gap-2 rounded-lg bg-teal-600 text-bone-50 px-3 py-2 text-sm font-medium hover:bg-teal-700 transition"
          >
            <Plus size={15} /> Nueva sesión
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-xs text-ink-400 px-2 py-4 text-center">Sin sesiones aún</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className={cn(
                "w-full text-left rounded-md px-3 py-2 text-xs transition",
                sessionId === s.id
                  ? "bg-teal-100 text-teal-800"
                  : "text-ink-600 hover:bg-bone-200",
              )}
            >
              <p className="truncate font-medium">{s.title}</p>
              {s.updatedAt && (
                <p className="text-ink-400 mt-0.5">
                  {new Date(s.updatedAt).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}
                </p>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/20 z-20 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-2 border-b border-bone-200 bg-bone-50">
          <button onClick={() => setShowSidebar(true)} className="text-ink-500">
            <MessageSquare size={18} />
          </button>
          <span className="text-sm font-medium text-ink-700 truncate">
            {sessionId ? sessions.find((s) => s.id === sessionId)?.title ?? "Mentor IA" : "Mentor IA"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {isEmpty && (
            <div className="max-w-xl mx-auto pt-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={26} className="text-teal-600" />
              </div>
              <h2 className="font-display text-2xl text-ink-900 mb-1">Mentor IA</h2>
              <p className="text-ink-500 text-sm mb-8">Tu tutor de fisiatría. Preguntá, pedí casos clínicos, flashcards o repaso de cualquier tema.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-bone-200 bg-white px-4 py-3 text-sm text-ink-700 hover:border-teal-400 hover:bg-teal-50/50 transition text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3",
                m.role === "user"
                  ? "bg-teal-600 text-bone-50 rounded-br-sm"
                  : "bg-white border border-bone-200 text-ink-800 rounded-bl-sm shadow-sm",
              )}>
                {m.role === "user" ? (
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="space-y-2">
                    {m.content
                      ? renderContent(m.content)
                      : <span className="inline-block w-2 h-4 bg-teal-400 animate-pulse rounded" />}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-bone-200 bg-bone-50 px-4 py-3">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí tu pregunta o pedí un modo de estudio…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-bone-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 max-h-36 overflow-y-auto"
              style={{ minHeight: "2.75rem" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              className="shrink-0 rounded-xl bg-teal-600 text-bone-50 p-3 hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-center text-xs text-ink-400 mt-2">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>
    </div>
  );
}
