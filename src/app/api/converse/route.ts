import { NextResponse } from "next/server";
import { converse } from "@/lib/mesh/pipeline";
import type { ConversationTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One round of the multi-round context conversation. */
export async function POST(req: Request) {
  let body: { text?: string; history?: ConversationTurn[]; round?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to discuss." }, { status: 400 });

  const history = Array.isArray(body.history) ? body.history : [];
  const round = Number.isFinite(body.round) ? Math.max(0, Number(body.round)) : 0;

  try {
    const result = await converse(text, history, round);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conversation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
