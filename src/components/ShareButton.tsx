"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";

/**
 * Builds a shareable warning-card PNG from the verdict and shares it via the
 * Web Share API (mobile) or downloads it (desktop) — the family-group loop.
 */
export function ShareButton({ result }: { result: AnalysisResult }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          risk_level: result.verdict.risk_level,
          headline: result.verdict.headline,
          confidence: result.verdict.confidence,
          red_flags: result.verdict.red_flags,
          models: result.opinions.length,
          match: result.matches[0]?.name,
        }),
      });
      if (!res.ok) throw new Error("card failed");
      const blob = await res.blob();
      const file = new File([blob], "rakshak-verdict.png", { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Rakshak scam check" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rakshak-verdict.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={share}
      disabled={busy}
      className="mono inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-[11px] text-muted hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      title="Share a warning card"
    >
      {busy ? "…" : "📤 Share card"}
    </button>
  );
}
