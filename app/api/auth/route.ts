import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_COOKIE_SECRET;
  if (!expected || !secret) {
    return NextResponse.json({ ok: false, error: "Servidor mal configurado" }, { status: 500 });
  }
  if (password !== expected) {
    // Tiny artificial delay to slow brute force; this is single-user but still.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("fp_auth", secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // 60 days
  });
  return res;
}
