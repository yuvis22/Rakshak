const LABELS: Record<string, string> = {
  "chat.completions": "Chat Completions",
  "structured-output": "Structured Output",
  compare: "Multi-model Compare",
  embeddings: "Embeddings (RAG)",
  "auto-routing": "Auto-Routing",
  "web-search": "Web Search",
  vision: "Vision",
  "speech-to-text": "Speech-to-Text",
  tts: "Text-to-Speech",
};

/** Shows which Mesh capabilities powered this run — the "no Mesh, no entry" proof. */
export function MeshFeatures({ features }: { features: string[] }) {
  if (!features.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mono text-[10px] uppercase tracking-wider text-muted">Powered by Mesh:</span>
      {features.map((f) => (
        <span
          key={f}
          className="mono rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] text-primary"
        >
          {LABELS[f] ?? f}
        </span>
      ))}
    </div>
  );
}
