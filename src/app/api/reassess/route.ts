import { NextResponse } from "next/server";
import { reassess } from "@/lib/mesh/pipeline";
import type { QuestionAnswer } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Re-evaluate a message with the user's context answers for a sharper verdict. */
export async function POST(req: Request) {
  let body: { text?: string; answers?: QuestionAnswer[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to re-assess." }, { status: 400 });

  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length === 0) {
    return NextResponse.json({ error: "Answer at least one question." }, { status: 400 });
  }

  try {
    const result = await reassess(text, answers);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Re-assessment failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
