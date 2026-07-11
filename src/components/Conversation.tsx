"use client";

import { useState } from "react";
import type { AnalysisResult, ConversationTurn, ConverseResponse, FollowUpQuestion, Verdict } from "@/lib/types";
import { VerdictCard } from "./VerdictCard";

type Answer = "yes" | "no" | "unsure";

/**
 * Multi-round context conversation. Rakshak asks a batch of questions; if it's
 * still unsure after your answers, it asks another round; once confident it
 * gives an updated verdict. Model-driven when live, heuristic offline.
 */
export function Conversation({ result }: { result: AnalysisResult }) {
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [batch, setBatch] = useState<FollowUpQuestion[] | null>(null);
  const [pending, setPending] = useState<Record<string, Answer>>({});
  const [note, setNote] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ verdict: Verdict; applied: string[] } | null>(null);

  async function call(hist: ConversationTurn[], rnd: number) {
    setBusy(true);
    try {
      const res = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.analyzed_text, history: hist, round: rnd }),
      });
      const data = (await res.json()) as ConverseResponse;
      if (!res.ok) return;
      if (data.action === "ask") {
        setBatch(data.questions);
        setPending({});
        setRound(data.round);
        setNote(data.note ?? null);
      } else {
        setBatch(null);
        setVerdict({ verdict: data.verdict, applied: data.applied });
      }
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setStarted(true);
    void call([], 0);
  }

  function submitBatch() {
    if (!batch) return;
    const turns: ConversationTurn[] = batch
      .filter((q) => pending[q.id])
      .map((q) => ({ id: q.id, question: q.question, answer: pending[q.id], risky_answer: q.risky_answer, weight: q.weight }));
    if (turns.length === 0) return;
    const next = [...history, ...turns];
    setHistory(next);
    void call(next, round);
  }

  const allAnswered = batch ? batch.every((q) => pending[q.id]) : false;

  if (!started) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Not sure? Let Rakshak ask you a few things</h3>
        <p className="mt-1 text-xs text-muted">
          The message alone can&apos;t see the phone call or the pressure behind it. Answer a short back-and-forth
          and Rakshak refines the verdict — over more than one round if needed.
        </p>
        <button
          onClick={start}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          Start guided check
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Guided check</h3>
        <span className="mono text-[10px] uppercase tracking-wider text-muted">round {Math.max(round, 1)}</span>
      </div>

      {/* answered transcript */}
      {history.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {history.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px]">
              <span className="mono text-muted">Q:</span>
              <span className="flex-1 text-foreground/80">{h.question}</span>
              <span className="mono capitalize text-primary">{h.answer}</span>
            </div>
          ))}
        </div>
      )}

      {/* current batch */}
      {batch && !verdict && (
        <div className="mt-4 space-y-3">
          {note && <p className="mono text-[11px] text-primary">{note}</p>}
          {batch.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-sm text-foreground/90">{q.question}</div>
              {q.hint && <div className="mt-0.5 text-[11px] text-muted">{q.hint}</div>}
              <div className="mt-2 flex gap-2">
                {(["yes", "no", "unsure"] as Answer[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPending((p) => ({ ...p, [q.id]: opt }))}
                    className={`mono rounded-lg px-3 py-1 text-[11px] transition-colors ${
                      pending[q.id] === opt ? "bg-primary text-background" : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {opt === "unsure" ? "not sure" : opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submitBatch}
            disabled={busy || !allAnswered}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Thinking…" : "Continue"}
          </button>
        </div>
      )}

      {busy && !batch && !verdict && <p className="mono mt-4 text-xs text-muted">Rakshak is thinking…</p>}

      {/* final verdict */}
      {verdict && (
        <div className="mt-5">
          <div className="mono mb-2 text-[11px] uppercase tracking-wider text-primary">Updated verdict</div>
          <VerdictCard verdict={verdict.verdict} />
          {verdict.applied.length > 0 && (
            <ul className="mt-3 space-y-1">
              {verdict.applied.map((a, i) => (
                <li key={i} className="mono text-[11px] text-muted">
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
