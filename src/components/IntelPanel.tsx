import type { WebIntel } from "@/lib/types";

export function IntelPanel({ intel }: { intel: WebIntel }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live web intel</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-muted">Mesh web search</span>
      </div>

      {intel.answer && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">{intel.answer}</p>
      )}

      {intel.sources.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {intel.sources.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[12px] text-primary/90 hover:underline"
              title={s.url}
            >
              ↗ {s.title || s.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
