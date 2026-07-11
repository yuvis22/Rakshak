import { analyze } from "@/lib/mesh/pipeline";
import type { StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming analysis over Server-Sent Events. Emits `stage` events as the
 * pipeline progresses and `opinion` events as each model responds, then a
 * final `result` event with the full AnalysisResult.
 */
export async function POST(req: Request) {
  let body: { text?: string; forceFallback?: boolean; image?: string; audio?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = (body.text ?? "").trim();
  const image = typeof body.image === "string" && body.image.startsWith("data:image/") ? body.image : undefined;
  const audio = typeof body.audio === "string" && body.audio.startsWith("data:audio/") ? body.audio : undefined;

  if (!text && !image && !audio) {
    return new Response("Nothing to analyse", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        } catch {
          /* controller closed */
        }
      };
      try {
        const result = await analyze(text, {
          forceFallback: Boolean(body.forceFallback),
          image,
          audio,
          emit: send,
        });
        send({ type: "result", result });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Analysis failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
