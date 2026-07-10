import type { ModelOpinion } from "@/lib/types";
import { riskMeta } from "@/lib/ui";

const STAGES = [
  { key: "input", label: "Media" },
  { key: "retrieve", label: "RAG match" },
  { key: "route", label: "Auto-route" },
  { key: "extract", label: "Extract" },
  { key: "intel", label: "Web intel" },
  { key: "consensus", label: "Consensus" },
  { key: "verdict", label: "Verdict" },
];

export function StreamProgress({
  activeStage,
  stageLabel,
  opinions,
}: {
  activeStage: string | null;
  stageLabel: string | null;
  opinions: ModelOpinion[];
}) {
  const activeIdx = STAGES.findIndex((s) => s.key === activeStage);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* pipeline stepper */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {STAGES.map((s, i) => {
          const done = activeIdx > i && activeIdx !== -1;
          const active = s.key === activeStage;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`mono rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${
                  active
                    ? "border-primary bg-primary/15 text-primary pulse-dot"
                    : done
                      ? "border-safe/40 bg-safe/10 text-safe"
                      : "border-border text-muted"
                }`}
              >
                {done ? "✓ " : ""}
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className="text-muted/40">›</span>}
            </div>
          );
        })}
      </div>

      {stageLabel && <p className="mono mt-4 text-xs text-primary">{stageLabel}</p>}

      {/* live opinions as they stream in */}
      {opinions.length > 0 && (
        <div className="mt-4 space-y-2">
          {opinions.map((o, i) => {
            const meta = riskMeta[o.risk_level];
            return (
              <div
                key={i}
                className="rise flex items-center gap-3 rounded-xl border border-border bg-background/40 p-2.5"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                >
                  {meta.emoji}
                </span>
                <span className="mono flex-1 truncate text-xs text-foreground/90">{o.model}</span>
                <span className="text-xs font-semibold" style={{ color: meta.color }}>
                  {meta.label} {Math.round(o.confidence)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
