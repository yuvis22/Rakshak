import { ImageResponse } from "next/og";
import type { RiskLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEME: Record<RiskLevel, { color: string; label: string; emoji: string }> = {
  safe: { color: "#2fd27a", label: "LIKELY SAFE", emoji: "✓" },
  suspicious: { color: "#f5b400", label: "SUSPICIOUS", emoji: "!" },
  scam: { color: "#ff5470", label: "SCAM ALERT", emoji: "✕" },
};

/**
 * Generates a shareable warning-card PNG (1080x1080) from a verdict.
 * Designed to be forwarded back into WhatsApp/family groups — the awareness
 * loop that makes Rakshak spread.
 */
export async function POST(req: Request) {
  let data: {
    risk_level?: RiskLevel;
    headline?: string;
    confidence?: number;
    red_flags?: string[];
    models?: number;
    matched?: string;
  };
  try {
    data = await req.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const risk: RiskLevel = data.risk_level ?? "suspicious";
  const t = THEME[risk];
  const flags = (data.red_flags ?? []).slice(0, 3);
  const confidence = Math.round(data.confidence ?? 0);

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
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "#7c5cff",
                color: "#07080c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                fontWeight: 700,
              }}
            >
              र
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#e9eaf0", fontSize: "34px", fontWeight: 700 }}>Rakshak</span>
              <span style={{ color: "#8b90a3", fontSize: "20px", letterSpacing: "4px" }}>SCAM SHIELD</span>
            </div>
          </div>
          <span style={{ color: "#8b90a3", fontSize: "22px" }}>checked via Mesh AI</span>
        </div>

        {/* risk badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginTop: "80px",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "60px",
              background: t.color,
              color: "#07080c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "72px",
              fontWeight: 700,
            }}
          >
            {t.emoji}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: t.color, fontSize: "64px", fontWeight: 700, letterSpacing: "2px" }}>
              {t.label}
            </span>
            <span style={{ color: "#8b90a3", fontSize: "28px" }}>{confidence}% confidence</span>
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            marginTop: "48px",
            color: "#e9eaf0",
            fontSize: "40px",
            lineHeight: 1.3,
          }}
        >
          {(data.headline ?? "").slice(0, 140)}
        </div>

        {/* red flags */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginTop: "48px" }}>
          {flags.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <span style={{ color: t.color, fontSize: "30px" }}>▸</span>
              <span style={{ color: "#c9ccd6", fontSize: "28px", lineHeight: 1.35 }}>{f.slice(0, 110)}</span>
            </div>
          ))}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: "40px",
            borderTop: "2px solid #1e2230",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#8b90a3", fontSize: "24px" }}>
            {data.matched ? `Matches: ${data.matched}` : "Never share OTP / PIN / passwords"}
          </span>
          <span style={{ color: "#8b90a3", fontSize: "24px" }}>Report fraud → 1930</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
