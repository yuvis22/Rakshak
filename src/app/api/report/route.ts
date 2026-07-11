import { NextResponse } from "next/server";
import { learnFromReport } from "@/lib/knowledge/learn";
import { allLearned } from "@/lib/knowledge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Teach Rakshak: a user confirms a message was a scam. We distil it into a
 * reusable pattern, persist it, and it immediately joins the RAG corpus so
 * future checks catch it — the self-learning loop.
 */
export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to learn from." }, { status: 400 });

  try {
    const pattern = await learnFromReport(text);
    return NextResponse.json({ pattern, learned_count: allLearned().length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to learn.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
