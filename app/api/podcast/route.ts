import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const type = (url.searchParams.get("type") ?? "post") as "pre" | "post";
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const firestore = db();
  // post podcasts keep the old doc ID for backwards compat; pre uses slug--pre
  const docId = type === "pre" ? `${slug}--pre` : slug;
  const podSnap = await firestore.collection("podcasts").doc(docId).get();
  if (!podSnap.exists) return NextResponse.json({ exists: false });

  const pod = podSnap.data()!;
  return NextResponse.json({
    exists: true,
    audioUrl: pod.audioUrl ?? null,
    script: pod.script ?? null,
    durationS: pod.durationS ?? null,
  });
}
