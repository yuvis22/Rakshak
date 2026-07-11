import { NextResponse } from "next/server";
import { analyze } from "@/lib/mesh/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: string; forceFallback?: boolean; image?: string; audio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : undefined;
  const audio = typeof body.audio === "string" && body.audio.startsWith("data:audio/") ? body.audio : undefined;

  if (!text && !image && !audio) {
    return NextResponse.json({ error: "Paste a message, screenshot, or voice note to check." }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Message too long (max 8000 characters)." }, { status: 400 });
  }

  try {
    const result = await analyze(text, { forceFallback: Boolean(body.forceFallback), image, audio });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
