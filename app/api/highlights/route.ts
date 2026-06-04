import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ items: [] });
  const snap = await db().collection("highlights").doc(slug).get();
  return NextResponse.json({ items: snap.exists ? (snap.data()!.items ?? []) : [] });
}

export async function POST(req: Request) {
  const { slug, items } = (await req.json()) as { slug: string; items: unknown[] };
  await db().collection("highlights").doc(slug).set({ items, updatedAt: new Date() });
  return NextResponse.json({ ok: true });
}
