import type { RetrievalInfo, ScamMatch } from "@/lib/types";

const statusColor: Record<ScamMatch["status"], string> = {
  trending: "#ff5470",
  ongoing: "#f5b400",
  classic: "#8b90a3",
};

export function MatchPanel({ matches, retrieval }: { matches: ScamMatch[]; retrieval: RetrievalInfo }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Matched scam patterns</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-muted">
          RAG · {retrieval.method === "embeddings" ? "semantic" : "lexical"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Closest matches from a database of {retrieval.corpus_size} active Indian scam patterns.
      </p>

      {matches.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-background/40 p-4 text-sm text-muted">
          No known scam pattern strongly matched this message.
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {matches.map((m, i) => (
            <div
              key={m.id}
              className="rise rounded-xl border border-border bg-background/40 p-3"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="mono shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                    style={{
                      color: statusColor[m.status],
                      background: `color-mix(in srgb, ${statusColor[m.status]} 15%, transparent)`,
                    }}
                  >
                    {m.status}
                  </span>
                  <span className="truncate text-sm font-medium">{m.name}</span>
                </div>
                <span className="mono shrink-0 text-xs text-foreground/70">{m.similarity}%</span>
              </div>
              {/* similarity bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${m.similarity}%`, background: "var(--primary)" }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{m.advice}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
