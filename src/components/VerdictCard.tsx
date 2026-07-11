import type { Verdict } from "@/lib/types";
import { riskMeta } from "@/lib/ui";

export function VerdictCard({ verdict, label }: { verdict: Verdict; label?: string }) {
  const meta = riskMeta[verdict.risk_level];
  return (
    <div
      className="rise rounded-2xl p-6 sm:p-7"
      style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {label && (
        <div className="mono mb-3 text-[11px] uppercase tracking-wider text-muted">{label}</div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-bold"
            style={{ background: meta.color, color: "#07080c" }}
          >
            {meta.emoji}
          </span>
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.2em]" style={{ color: meta.color }}>
              {meta.label}
            </div>
            <h2 className="mt-0.5 text-xl font-semibold sm:text-2xl">{verdict.headline}</h2>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: meta.color }}>
            {Math.round(verdict.confidence)}%
          </div>
          <div className="mono text-[10px] uppercase tracking-wider text-muted">confidence</div>
        </div>
      </div>

      <p className="mt-5 text-[15px] leading-relaxed text-foreground/85">{verdict.explanation}</p>

      {verdict.red_flags.length > 0 && (
        <div className="mt-5">
          <div className="mono text-[11px] uppercase tracking-wider text-muted">Red flags</div>
          <ul className="mt-2 space-y-1.5">
            {verdict.red_flags.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/85">
                <span style={{ color: meta.color }}>▸</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-border bg-background/40 p-4">
        <div className="mono text-[11px] uppercase tracking-wider text-muted">What to do</div>
        <ol className="mt-2 space-y-1.5">
          {verdict.recommended_actions.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground/90">
              <span className="mono text-muted">{i + 1}.</span>
              <span>{a}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
