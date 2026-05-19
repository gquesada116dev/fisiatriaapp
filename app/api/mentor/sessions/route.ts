import { NextResponse } from "next/server";
import { db, Timestamp } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const firestore = db();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const snap = await firestore.collection("mentorSessions").doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const data = snap.data()!;
    return NextResponse.json({
      id: snap.id,
      title: data.title,
      messages: data.messages ?? [],
    });
  }

  const snaps = await firestore
    .collection("mentorSessions")
    .orderBy("updatedAt", "desc")
    .limit(30)
    .get();

  const sessions = snaps.docs.map((d) => ({
    id: d.id,
    title: d.data().title ?? "Sesión",
    updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
  }));

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const { id, title, messages } = (await req.json()) as {
    id: string;
    title: string;
    messages: { role: string; content: string }[];
  };

  const firestore = db();
  const ref = firestore.collection("mentorSessions").doc(id);
  const snap = await ref.get();

  if (snap.exists) {
    await ref.update({ messages, title, updatedAt: Timestamp.now() });
  } else {
    await ref.set({ title, messages, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }

  return NextResponse.json({ ok: true });
}
