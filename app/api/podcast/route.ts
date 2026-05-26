import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();
  const topicSnap = await firestore.collection("topics").doc(slug).get();
  if (!topicSnap.exists) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const podSnap = await firestore.collection("podcasts").doc(slug).get();
  if (!podSnap.exists) return NextResponse.json({ exists: false });

  const pod = podSnap.data()!;
  return NextResponse.json({ exists: true, audioUrl: pod.audioUrl, script: pod.script, durationS: pod.durationS ?? null });
}

