import { NextResponse } from "next/server";
import { analyze } from "@/lib/mesh/pipeline";
import type { Mode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: string; mode?: Mode; forceFallback?: boolean; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : undefined;

  if (!text && !image) {
    return NextResponse.json({ error: "Paste a message or upload a screenshot to check." }, { status: 400 });
  }
  if (text.length > 8000) {
    return NextResponse.json({ error: "Message too long (max 8000 characters)." }, { status: 400 });
  }

  const mode: Mode = body.mode === "paid" ? "paid" : "free";

  try {
    const result = await analyze(text, mode, { forceFallback: Boolean(body.forceFallback), image });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
