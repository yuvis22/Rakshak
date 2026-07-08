import { NextResponse } from "next/server";
import { isLive, listModels } from "@/lib/mesh/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists models so the UI can show the real free/paid line-up powering a mode. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const freeOnly = searchParams.get("free") === "1";

  if (!isLive()) {
    return NextResponse.json({ live: false, models: [] });
  }

  try {
    const models = await listModels(freeOnly);
    return NextResponse.json({
      live: true,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        is_free: m.is_free,
        structured: Boolean(m.supports_structured_output),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list models.";
    return NextResponse.json({ live: true, models: [], error: message }, { status: 502 });
  }
}
