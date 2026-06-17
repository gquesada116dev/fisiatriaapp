import { NextResponse } from "next/server";
import { db, Timestamp } from "@/lib/db/firebase";

export const runtime = "nodejs";

const DOC = () => db().collection("studyPlanProgress").doc("bele");

// GET → { done: { [key]: true } }
export async function GET() {
  const snap = await DOC().get();
  const done = snap.exists ? (snap.data()?.done ?? {}) : {};
  return NextResponse.json({ done });
}

// POST { key, done } → toggle a single item's completion
export async function POST(req: Request) {
  const body = (await req.json()) as { key?: string; done?: boolean };
  if (!body.key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const ref = DOC();
  const snap = await ref.get();
  const done: Record<string, boolean> = snap.exists ? (snap.data()?.done ?? {}) : {};

  if (body.done) done[body.key] = true;
  else delete done[body.key];

  await ref.set({ done, updatedAt: Timestamp.now() }, { merge: true });
  return NextResponse.json({ done });
}
