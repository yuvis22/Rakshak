"use client";

import { useState } from "react";

/**
 * Plays the verdict as speech. Uses Mesh TTS when available; if the server
 * responds 409 (no balance/key), falls back to the browser's speech synthesis
 * so the feature still works during dev.
 */
export function ListenButton({ text, lang }: { text: string; lang?: string }) {
  const [busy, setBusy] = useState(false);

  async function play() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });

      if (res.ok && res.headers.get("content-type")?.startsWith("audio")) {
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.onended = () => setBusy(false);
        await audio.play();
        return;
      }
      // Fallback: browser speech synthesis.
      browserSpeak(text);
    } catch {
      browserSpeak(text);
    } finally {
      // For browser TTS we can't easily await; release the button shortly.
      setTimeout(() => setBusy(false), 400);
    }
  }

  return (
    <button
      onClick={play}
      disabled={busy}
      className="mono inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-[11px] text-muted hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      title="Listen to the verdict"
    >
      {busy ? "▶ playing…" : "🔊 Listen"}
    </button>
  );
}

function browserSpeak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(u);
}
