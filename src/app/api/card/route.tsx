import { ImageResponse } from "next/og";
import type { RiskLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLORS: Record<RiskLevel, { accent: string; label: string; emoji: string }> = {
  safe: { accent: "#2fd27a", label: "SAFE", emoji: "✓" },
  suspicious: { accent: "#f5b400", label: "SUSPICIOUS", emoji: "!" },
  scam: { accent: "#ff5470", label: "SCAM", emoji: "✕" },
};

/**
 * Generates a shareable warning-card PNG (1080x1080) for a verdict, so users
 * can forward the result back into WhatsApp/family groups — the awareness loop.
 */
export async function POST(req: Request) {
  let body: {
    risk_level?: RiskLevel;
    headline?: string;
    confidence?: number;
    red_flags?: string[];
    models?: number;
    match?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const risk: RiskLevel = body.risk_level ?? "suspicious";
  const c = COLORS[risk];
  const headline = (body.headline ?? "").slice(0, 120);
  const flags = (body.red_flags ?? []).slice(0, 3);
  const confidence = Math.round(body.confidence ?? 0);
  const models = body.models ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          background: "#07080c",
          padding: "72px",
          fontFamily: "sans-serif",
          color: "#e9eaf0",
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "#7c5cff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
              fontWeight: 700,
              color: "#07080c",
            }}
          >
            र
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "34px", fontWeight: 700 }}>Rakshak</span>
            <span style={{ fontSize: "20px", color: "#8b90a3", letterSpacing: "3px" }}>SCAM SHIELD</span>
          </div>
        </div>

        {/* verdict badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
            marginTop: "90px",
          }}
        >
          <div
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              background: c.accent,
              color: "#07080c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "96px",
              fontWeight: 800,
            }}
          >
            {c.emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "96px", fontWeight: 800, color: c.accent, lineHeight: 1 }}>{c.label}</span>
            <span style={{ fontSize: "34px", color: "#8b90a3", marginTop: "12px" }}>
              {confidence}% confidence · {models} AI models
            </span>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", marginTop: "56px", fontSize: "44px", fontWeight: 600, lineHeight: 1.25 }}>
          {headline}
        </div>

        {/* flags */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "44px" }}>
          {flags.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px", fontSize: "30px", color: "#c7cad6" }}>
              <span style={{ color: c.accent }}>▸</span>
              <span>{f.slice(0, 90)}</span>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #1e2230",
            paddingTop: "32px",
            fontSize: "26px",
            color: "#8b90a3",
          }}
        >
          <span>Checked across multiple AI models via Mesh API</span>
          <span>Report fraud → 1930</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
