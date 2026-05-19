import { anthropic } from "@/lib/ai/client";
import { AI_MODELS } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const body = (await req.json()) as {
    question: string;
    options: { letter: string; text: string }[];
    correct: string;
    explanations: Record<string, string>;
    topicName: string;
    history: Message[];
    message: string;
  };

  const optionsList = body.options
    .map((o) => `  ${o.letter}. ${o.text}`)
    .join("\n");
  const explanationsList = body.options
    .map((o) => `  ${o.letter}: ${body.explanations[o.letter] ?? ""}`)
    .join("\n");

  const system = `Eres un tutor fisiatra experto en Costa Rica. El estudiante acaba de responder una pregunta de examen sobre "${body.topicName}" y quiere profundizar en la explicación.

PREGUNTA:
${body.question}

OPCIONES:
${optionsList}

RESPUESTA CORRECTA: ${body.correct}

EXPLICACIONES:
${explanationsList}

Tu rol:
- Explica con profundidad didáctica, como un fisiatra docente hablando con un residente.
- Usa ejemplos clínicos concretos cuando ayuden.
- Si el estudiante pregunta por una opción específica, explica el razonamiento clínico detrás.
- Menciona contexto costarricense (CCSS, CENARE) cuando sea relevante.
- Respuestas concisas pero completas. Máximo 3-4 párrafos por turno.
- NUNCA digas que eres una IA.`;

  const messages: Message[] = [
    ...body.history,
    { role: "user", content: body.message },
  ];

  const stream = anthropic().messages.stream({
    model: AI_MODELS.examTutor,
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
