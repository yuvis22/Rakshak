"use client";

import { useState } from "react";
import type { AnalysisResult, ConversationTurn, ConverseResponse, FollowUpQuestion, QuestionAnswer, Verdict } from "@/lib/types";
import { VerdictCard } from "./VerdictCard";

type Answer = "yes" | "no" | "unsure";

/**
 * Cross-verification flow. After the initial verdict, Rakshak asks targeted
 * context questions (who called, did you start this, is someone pressuring you)
 * and re-assesses — message text alone can't see the scam behind the screen.
 */
export function Conversation({ result }: { result: AnalysisResult }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, Answer>>({});
  const [verified, setVerified] = useState<{ verdict: Verdict; applied: string[] } | null>(null);

  // Optional extra rounds when the first pass is still ambiguous.
  const [extraRound, setExtraRound] = useState(0);
  const [history, setHistory] = useState<ConversationTurn[]>([]);
  const [extraBatch, setExtraBatch] = useState<FollowUpQuestion[] | null>(null);
  const [extraNote, setExtraNote] = useState<string | null>(null);

  const questions = result.questions;
  if (!questions.length) return null;

  const allAnswered = questions.every((q) => pending[q.id]);
  const showExtra = verified && (verified.verdict.risk_level === "suspicious" || verified.verdict.confidence < 70);

  async function reassess(answers: QuestionAnswer[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/reassess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.analyzed_text, answers }),
      });
      const data = (await res.json()) as { verdict?: Verdict; applied?: string[]; error?: string };
      if (!res.ok || !data.verdict) return;
      setVerified({ verdict: data.verdict, applied: data.applied ?? [] });
    } finally {
      setBusy(false);
    }
  }

  function submitVerification() {
    const answers: QuestionAnswer[] = questions
      .filter((q) => pending[q.id])
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: pending[q.id],
        risky_answer: q.risky_answer,
        weight: q.weight,
      }));
    if (!answers.length) return;
    void reassess(answers);
  }

  async function callExtra(hist: ConversationTurn[], rnd: number) {
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
        setExtraBatch(data.questions);
        setExtraRound(data.round);
        setExtraNote(data.note ?? null);
        setPending({});
      } else {
        setExtraBatch(null);
        setVerified({ verdict: data.verdict, applied: data.applied });
      }
    } finally {
      setBusy(false);
    }
  }

  function startExtra() {
    const firstTurns: ConversationTurn[] = questions
      .filter((q) => pending[q.id])
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: pending[q.id],
        risky_answer: q.risky_answer,
        weight: q.weight,
      }));
    setHistory(firstTurns);
    void callExtra(firstTurns, 1);
  }

  function submitExtra() {
    if (!extraBatch) return;
    const turns: ConversationTurn[] = extraBatch
      .filter((q) => pending[q.id])
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: pending[q.id],
        risky_answer: q.risky_answer,
        weight: q.weight,
      }));
    if (!turns.length) return;
    const next = [...history, ...turns];
    setHistory(next);
    void callExtra(next, extraRound);
  }

  const extraAllAnswered = extraBatch ? extraBatch.every((q) => pending[q.id]) : false;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Verify with a few quick questions</h3>
          <p className="mt-1 text-xs text-muted">
            The message alone can&apos;t see the phone call or pressure behind it. Answer honestly — Rakshak
            cross-checks your situation to confirm whether this is really a scam.
          </p>
        </div>
        {!verified && (
          <span className="mono shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
            step 2
          </span>
        )}
      </div>

      {/* first-pass verification */}
      {!verified && (
        <div className="mt-4 space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-sm text-foreground/90">{q.question}</div>
              {q.hint && <div className="mt-0.5 text-[11px] text-muted">{q.hint}</div>}
              <div className="mt-2 flex gap-2">
                {(["yes", "no", "unsure"] as Answer[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPending((p) => ({ ...p, [q.id]: opt }))}
                    className={`mono rounded-lg px-3 py-1 text-[11px] transition-colors ${
                      pending[q.id] === opt
                        ? "bg-primary text-background"
                        : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {opt === "unsure" ? "not sure" : opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submitVerification}
            disabled={busy || !allAnswered}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Verifying…" : "Confirm verdict"}
          </button>
        </div>
      )}

      {/* verified verdict */}
      {verified && !extraBatch && (
        <div className="mt-5">
          <div className="mono mb-2 text-[11px] uppercase tracking-wider text-primary">Verified verdict</div>
          <VerdictCard verdict={verified.verdict} />
          {verified.applied.length > 0 && (
            <ul className="mt-3 space-y-1">
              {verified.applied.map((a, i) => (
                <li key={i} className="mono text-[11px] text-muted">
                  {a}
                </li>
              ))}
            </ul>
          )}
          {showExtra && (
            <button
              onClick={startExtra}
              disabled={busy}
              className="mt-4 text-xs text-muted underline hover:text-foreground"
            >
              Still unsure? Answer a few more questions
            </button>
          )}
        </div>
      )}

      {/* optional extra round */}
      {extraBatch && (
        <div className="mt-4 space-y-3">
          {extraNote && <p className="mono text-[11px] text-primary">{extraNote}</p>}
          {history.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-muted">
              <span className="mono">Q:</span>
              <span className="flex-1">{h.question}</span>
              <span className="mono capitalize text-primary">{h.answer}</span>
            </div>
          ))}
          {extraBatch.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="text-sm text-foreground/90">{q.question}</div>
              {q.hint && <div className="mt-0.5 text-[11px] text-muted">{q.hint}</div>}
              <div className="mt-2 flex gap-2">
                {(["yes", "no", "unsure"] as Answer[]).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPending((p) => ({ ...p, [q.id]: opt }))}
                    className={`mono rounded-lg px-3 py-1 text-[11px] transition-colors ${
                      pending[q.id] === opt
                        ? "bg-primary text-background"
                        : "border border-border text-muted hover:text-foreground"
                    }`}
                  >
                    {opt === "unsure" ? "not sure" : opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submitExtra}
            disabled={busy || !extraAllAnswered}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Thinking…" : "Continue"}
          </button>
        </div>
      )}

      {busy && verified && extraBatch === null && !showExtra && (
        <p className="mono mt-4 text-xs text-muted">Rakshak is thinking…</p>
      )}
    </div>
  );
}
