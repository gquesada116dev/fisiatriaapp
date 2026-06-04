import { NextResponse } from "next/server";
import { db } from "@/lib/db/firebase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ htmlContent: "" });
  const snap = await db().collection("notes").doc(slug).get();
  return NextResponse.json({ htmlContent: snap.exists ? (snap.data()!.htmlContent ?? "") : "" });
}

export async function POST(req: Request) {
  const { slug, htmlContent } = (await req.json()) as { slug: string; htmlContent: string };
  await db().collection("notes").doc(slug).set({ htmlContent, updatedAt: new Date() });
  return NextResponse.json({ ok: true });
}
