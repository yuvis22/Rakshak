import { NextResponse } from "next/server";
import { isLive, speak } from "@/lib/mesh/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Text-to-Speech via Mesh. Returns audio bytes for the verdict so users can
 * *hear* the result — useful for low-literacy / accessibility (Bharat track).
 * If no Mesh balance/key, responds 409 so the client falls back to the
 * browser's built-in speech synthesis.
 */
export async function POST(req: Request) {
  let body: { text?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  if (!isLive()) {
    return NextResponse.json({ error: "offline", fallback: "browser" }, { status: 409 });
  }

  try {
    const { audio, contentType } = await speak({
      input: text.slice(0, 800),
      language_code: body.language,
    });
    return new NextResponse(audio, { headers: { "Content-Type": contentType } });
  } catch {
    // Let the client fall back to browser speech synthesis.
    return NextResponse.json({ error: "tts_failed", fallback: "browser" }, { status: 409 });
  }
}
