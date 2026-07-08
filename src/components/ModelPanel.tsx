import type { ModelOpinion } from "@/lib/types";
import { riskMeta } from "@/lib/ui";

export function ModelPanel({ opinions }: { opinions: ModelOpinion[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Multi-model consensus</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-muted">
          {opinions.length} models · via Mesh
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        The same message, judged in parallel by different models. Disagreement is a signal in itself.
      </p>

      <div className="mt-4 space-y-2.5">
        {opinions.map((o, i) => {
          const meta = riskMeta[o.risk_level];
          return (
            <div
              key={i}
              className="rise flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
              >
                {meta.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="mono truncate text-xs text-foreground/90">{o.model}</span>
                  {o.error && (
                    <span className="mono rounded bg-danger/15 px-1.5 text-[10px] text-danger">error</span>
                  )}
                </div>
                <div className="truncate text-[11px] text-muted">{o.rationale}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                <div className="mono text-[10px] text-muted">
                  {Math.round(o.confidence)}%{o.latency_ms ? ` · ${o.latency_ms}ms` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
