"use client";

import { useState } from "react";
import type { AnalysisResult, Mode, ModelOpinion, StreamEvent } from "@/lib/types";
import { StreamProgress } from "@/components/StreamProgress";
import { VerdictCard } from "@/components/VerdictCard";
import { ModelPanel } from "@/components/ModelPanel";
import { OrchestrationPanel } from "@/components/OrchestrationPanel";
import { MatchPanel } from "@/components/MatchPanel";
import { IntelPanel } from "@/components/IntelPanel";
import { MeshFeatures } from "@/components/MeshFeatures";
import { ListenButton } from "@/components/ListenButton";
import { ShareButton } from "@/components/ShareButton";

const DEFAULT_MODE: Mode = process.env.NEXT_PUBLIC_DEFAULT_MODE === "paid" ? "paid" : "free";

const EXAMPLES = [
  "Dear customer, your SBI account will be BLOCKED today. Complete KYC now: http://sbi-kyc-verify.link/update Share OTP to confirm.",
  "Congratulations! Aapne ₹25,00,000 ka KBC lucky draw jeeta hai. Claim karne ke liye is number pe call karo aur registration fee bhejo.",
  "Hi, this is your electricity board. Your connection will be disconnected tonight at 9:30 PM. Call 8XXXXXXXXX immediately.",
  "Hey, are we still meeting at 5pm for coffee near the office?",
];

export default function Home() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [audio, setAudio] = useState<{ url: string; name: string } | null>(null);
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [forceFallback, setForceFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<{ key: string; label: string } | null>(null);
  const [liveOpinions, setLiveOpinions] = useState<ModelOpinion[]>([]);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onPickAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Audio too large (max 10 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAudio({ url: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  async function run() {
    if ((!text.trim() && !image && !audio) || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStage(null);
    setLiveOpinions([]);
    try {
      const res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, forceFallback, image, audio: audio?.url }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5).trim()) as StreamEvent;
          if (ev.type === "stage") setStage({ key: ev.stage, label: ev.label });
          else if (ev.type === "opinion") setLiveOpinions((prev) => [...prev, ev.opinion]);
          else if (ev.type === "result") setResult(ev.result);
          else if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-lg font-bold text-background">
            र
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-none">Rakshak</div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted">scam shield</div>
          </div>
        </div>
        <ModeToggle mode={mode} setMode={setMode} />
      </header>

      {/* Hero */}
      <section className="mt-10 sm:mt-14">
        <span className="mono text-[11px] uppercase tracking-[0.3em] text-primary">
          Mesh API Hackathon · 2026
        </span>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Is this message a scam?
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Paste any suspicious SMS, WhatsApp forward, or email. Rakshak checks it across multiple AI
          models in parallel through the Mesh API and tells you what to do.
        </p>
      </section>

      {/* Input */}
      <section className="mt-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the message here… (Hindi / Hinglish / English all work)"
          rows={5}
          className="w-full resize-y rounded-2xl border border-border bg-card p-4 text-[15px] leading-relaxed outline-none placeholder:text-muted/70 focus:border-primary/60"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setText(ex)}
              className="mono max-w-full truncate rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted hover:border-primary/50 hover:text-foreground"
              style={{ maxWidth: 220 }}
            >
              {i === EXAMPLES.length - 1 ? "🟢 safe example" : `⚠ example ${i + 1}`}
            </button>
          ))}
          <label className="mono cursor-pointer rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted hover:border-primary/50 hover:text-foreground">
            📷 Upload screenshot
            <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
          </label>
          <label className="mono cursor-pointer rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted hover:border-primary/50 hover:text-foreground">
            🎙 Voice note
            <input type="file" accept="audio/*" onChange={onPickAudio} className="hidden" />
          </label>
        </div>

        {image && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="screenshot preview" className="h-14 w-14 rounded-md object-cover" />
            <span className="text-xs text-muted">Screenshot attached — Mesh vision will read it.</span>
            <button
              onClick={() => setImage(null)}
              className="mono ml-auto rounded px-2 py-1 text-[11px] text-danger hover:bg-danger/10"
            >
              remove
            </button>
          </div>
        )}

        {audio && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
            <span className="text-lg">🎙</span>
            <span className="truncate text-xs text-muted">{audio.name} — Mesh will transcribe (Indian languages).</span>
            <button
              onClick={() => setAudio(null)}
              className="mono ml-auto rounded px-2 py-1 text-[11px] text-danger hover:bg-danger/10"
            >
              remove
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={forceFallback}
              onChange={(e) => setForceFallback(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Demo live fallback (force primary model to fail)
          </label>
          <button
            onClick={run}
            disabled={loading || (!text.trim() && !image && !audio)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Checking…" : "Check message"}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="mono mt-6 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Live pipeline progress */}
      {loading && (
        <div className="mt-8">
          <StreamProgress activeStage={stage?.key ?? null} stageLabel={stage?.label ?? null} opinions={liveOpinions} />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MeshFeatures features={result.mesh_features} />
            <div className="flex items-center gap-2">
              {result.source !== "text" && (
                <span className="mono rounded-full border border-border px-2.5 py-0.5 text-[10px] text-muted">
                  {result.source === "image" ? "read from screenshot" : "transcribed from voice note"}
                </span>
              )}
              <ListenButton
                text={`${result.verdict.headline}. ${result.verdict.explanation}`}
                lang={result.signal.language}
              />
              <ShareButton result={result} />
            </div>
          </div>
          <VerdictCard verdict={result.verdict} />
          <MatchPanel matches={result.matches} retrieval={result.retrieval} />
          {result.intel && <IntelPanel intel={result.intel} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <ModelPanel opinions={result.opinions} />
            <OrchestrationPanel result={result} />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-16 border-t border-border pt-6">
        <p className="text-xs text-muted">
          Every AI call routes through the{" "}
          <a href="https://meshapi.ai" className="text-foreground/80 underline" target="_blank" rel="noreferrer">
            Mesh API
          </a>
          . Rakshak gives a risk assessment, not a guarantee — when in doubt, verify with your bank&apos;s
          official helpline and report fraud to 1930 / cybercrime.gov.in.
        </p>
      </footer>
    </main>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {(["free", "paid"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`mono rounded-full px-3 py-1 text-[11px] uppercase tracking-wider transition-colors ${
            mode === m ? "bg-primary text-background" : "text-muted hover:text-foreground"
          }`}
          title={m === "free" ? "Lowest-cost models for dev/testing" : "Premium models for best results"}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
