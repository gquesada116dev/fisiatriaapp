import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Proxy Firebase Storage audio with proper range-request forwarding so browser seek works.
export async function GET(req: Request) {
  const src = new URL(req.url).searchParams.get("src");

  if (!src || !src.startsWith("https://firebasestorage.googleapis.com/")) {
    return NextResponse.json({ error: "invalid src" }, { status: 400 });
  }

  const upstreamHeaders: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) upstreamHeaders["range"] = range;

  const upstream = await fetch(src, { headers: upstreamHeaders });

  const responseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders["Content-Type"] = contentType;

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) responseHeaders["Content-Length"] = contentLength;

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders["Content-Range"] = contentRange;

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
