import { chat, isLive } from "@/lib/mesh/client";
import { basePlan } from "@/lib/mesh/models";
import { fenceUntrusted, INJECTION_GUARD } from "@/lib/security";
import { addLearned, type LearnedPattern } from "./store";

const PATTERN_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    tactics: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    aliases: { type: "array", items: { type: "string" } },
    typical_ask: { type: "string" },
    advice: { type: "string" },
  },
  required: ["name", "category", "description", "tactics", "keywords", "typical_ask", "advice"],
  additionalProperties: false,
} as const;

const STOP = new Set(["the", "and", "you", "your", "for", "with", "this", "that", "are", "will", "from", "have"]);

/** Offline heuristic: derive a rough pattern from keywords in the message. */
function heuristicPattern(text: string): Partial<LearnedPattern> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  return {
    name: "User-reported scam",
    category: "other",
    description: "A scam pattern reported by a Rakshak user.",
    tactics: ["user-reported"],
    keywords,
    aliases: [],
    typical_ask: "Varies",
    advice: "Do not respond, click links, or share OTP/PIN. Verify independently and report to 1930.",
  };
}

/** Distil a confirmed scam message into a reusable pattern and persist it. */
export async function learnFromReport(text: string): Promise<LearnedPattern> {
  let base: Partial<LearnedPattern> = heuristicPattern(text);

  if (isLive()) {
    try {
      const res = await chat({
        model: basePlan().extractor,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: { name: "scam_pattern", schema: PATTERN_SCHEMA } },
        messages: [
          {
            role: "system",
            content:
              "Distil this confirmed scam message into a reusable detection pattern. Return schema JSON with a short name, category, description, tactics, keywords (lowercase terms that identify this scam), aliases, typical_ask, and safety advice. " +
              INJECTION_GUARD,
          },
          { role: "user", content: fenceUntrusted(text) },
        ],
      });
      const parsed = JSON.parse(res.content.replace(/```json|```/gi, "").trim());
      if (parsed?.name) base = parsed;
    } catch {
      /* keep heuristic */
    }
  }

  const pattern: LearnedPattern = {
    id: `learned-${Date.now()}`,
    status: "trending",
    learned: true,
    reported_at: new Date().toISOString(),
    name: base.name ?? "User-reported scam",
    category: base.category ?? "other",
    aliases: base.aliases ?? [],
    description: base.description ?? "A scam pattern reported by a Rakshak user.",
    tactics: base.tactics ?? ["user-reported"],
    keywords: (base.keywords ?? []).map((k) => k.toLowerCase()),
    typical_ask: base.typical_ask ?? "Varies",
    advice: base.advice ?? "Do not respond or share OTP/PIN. Verify independently and report to 1930.",
  };

  addLearned(pattern);
  return pattern;
}
