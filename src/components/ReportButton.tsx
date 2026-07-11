"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";

/**
 * "Teach Rakshak" — user confirms a scam; we distil and persist it so the RAG
 * corpus grows and future checks catch it. The self-learning loop.
 */
export function ReportButton({ result }: { result: AnalysisResult }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [count, setCount] = useState<number | null>(null);

  async function report() {
    if (state === "busy" || state === "done") return;
    setState("busy");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.analyzed_text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setCount(data.learned_count ?? null);
      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="mono rounded-lg border border-safe/40 bg-safe/10 px-3 py-1.5 text-[11px] text-safe">
        ✓ Added to shield{count != null ? ` · ${count} learned` : ""}
      </span>
    );
  }

  return (
    <button
      onClick={report}
      disabled={state === "busy"}
      className="mono inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-[11px] text-muted hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      title="Confirm this is a scam so Rakshak learns it"
    >
      {state === "busy" ? "…" : "🛡 Teach Rakshak"}
    </button>
  );
}
