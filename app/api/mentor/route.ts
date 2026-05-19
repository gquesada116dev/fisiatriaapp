import { db } from "@/lib/db/firebase";
import { anthropic } from "@/lib/ai/client";
import { mentorSystemPrompt } from "@/lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS } from "@/lib/ai/config";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const topicsSnap = await db().collection("topics").orderBy("sortOrder").get();
  const topics = topicsSnap.docs.map((d) => ({
    name: d.data().name as string,
    category: d.data().category as string,
  }));

  const system = mentorSystemPrompt(topics);

  const stream = anthropic().messages.stream({
    model: AI_MODELS.mentor,
    max_tokens: MAX_TOKENS.mentor,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`,
              ),
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        controller.error(e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
