import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { topicSlug } = (await req.json()) as { topicSlug: string };
  const firestore = db();

  const topicSnap = await firestore.collection("topics").doc(topicSlug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  const topic = topicSnap.data()!;

  const summarySnap = await firestore.collection("summaries").doc(topicSlug).get();
  if (!summarySnap.exists) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  const cached = summarySnap.data()!;
  return NextResponse.json({
    exists: true,
    content_md: cached.contentMd,
    model: cached.model,
    imageUrl: topic.imageUrl ?? null,
  });
}
