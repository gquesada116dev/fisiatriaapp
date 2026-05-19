import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";
import { anthropic, textFromResponse } from "@/lib/ai/client";
import { summaryPrompt } from "@/lib/ai/prompts";
import { AI_MODELS, MAX_TOKENS, PROMPT_VERSIONS } from "@/lib/ai/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { topicSlug, force } = (await req.json()) as { topicSlug: string; force?: boolean };
  const firestore = db();

  const topicSnap = await firestore.collection("topics").doc(topicSlug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  const topic = { slug: topicSlug, ...topicSnap.data() } as any;

  if (!force) {
    const summarySnap = await firestore.collection("summaries").doc(topicSlug).get();
    if (summarySnap.exists) {
      const cached = summarySnap.data()!;
      if (cached.promptV === PROMPT_VERSIONS.summary) {
        return NextResponse.json({ cached: true, content_md: cached.contentMd, model: cached.model, imageUrl: topic.imageUrl ?? null });
      }
    }
  }

  const { system, user } = summaryPrompt(topic);
  const resp = await anthropic().messages.create({
    model: AI_MODELS.summary,
    max_tokens: MAX_TOKENS.summary,
    system,
    messages: [{ role: "user", content: user }],
  });
  const content_md = textFromResponse(resp);

  await firestore.collection("summaries").doc(topicSlug).set({
    topicSlug,
    contentMd: content_md,
    model: AI_MODELS.summary,
    promptV: PROMPT_VERSIONS.summary,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ cached: false, content_md, model: AI_MODELS.summary, imageUrl: topic.imageUrl ?? null });
}
