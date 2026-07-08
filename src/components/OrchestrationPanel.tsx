import type { AnalysisResult } from "@/lib/types";

export function OrchestrationPanel({ result }: { result: AnalysisResult }) {
  const { routing, signal, usage, total_latency_ms, mock } = result;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mesh orchestration</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-muted">
          {mock ? "mock engine" : "live"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Cell label="Detected language" value={signal.language} />
        <Cell label="Threat category" value={signal.threat_category.replace(/_/g, " ")} />
        <Cell
          label={routing.triage_auto_routed ? "Triage (auto-routed)" : "Triage model"}
          value={routing.triage_model}
          mono
          accent={routing.triage_auto_routed}
        />
        <Cell
          label="Routing"
          value={routing.escalated ? "escalated → strong model" : "low-cost route"}
          accent={routing.escalated}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip on={signal.contains_sensitive_request} label="secret requested" />
        <Chip on={signal.links.length > 0} label={`${signal.links.length} link(s)`} />
        <Chip on={signal.urgency === "high"} label="high urgency" />
        <Chip on={routing.fallback_used} label="fallback used" tone="danger" />
      </div>

      {routing.fallback_note && (
        <div className="mono mt-3 rounded-lg border border-safe/30 bg-safe/10 p-2.5 text-[11px] text-safe">
          ↻ {routing.fallback_note}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="mono text-[11px] text-muted">
          {usage.length} model call(s) · {total_latency_ms}ms
        </span>
        <span className="mono text-[11px] text-muted">
          {mock ? "₹0 · offline engine" : result.mode === "free" ? "lowest-cost models" : "premium models"}
        </span>
      </div>
    </div>
  );
}

function Cell({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="mono text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 truncate ${mono ? "mono" : ""} ${accent ? "text-warn" : "text-foreground/90"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Chip({ on, label, tone = "primary" }: { on: boolean; label: string; tone?: "primary" | "danger" }) {
  if (!on) return null;
  const color = tone === "danger" ? "var(--danger)" : "var(--primary)";
  return (
    <span
      className="mono rounded-full px-2.5 py-0.5 text-[10px]"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      {label}
    </span>
  );
}
