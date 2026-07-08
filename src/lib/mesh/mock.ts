import type {
  AnalysisResult,
  Mode,
  ModelOpinion,
  RiskLevel,
  ScamMatch,
  ScamSignal,
  Verdict,
} from "@/lib/types";
import { basePlan } from "./models";
import { retrieve } from "@/lib/knowledge/retrieval";

/**
 * Heuristic mock engine. Runs when no Mesh key is configured so the whole app
 * is demoable offline. The real pipeline (pipeline.ts) mirrors this shape but
 * gets its judgement from models via Mesh.
 */

const URL_RE = /\bhttps?:\/\/[^\s]+|\b[a-z0-9-]+\.(?:com|in|net|org|xyz|link|info)\b[^\s]*/gi;
const AMOUNT_RE = /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d+)?/i;

const SCAM_TERMS = [
  "otp", "kyc", "verify", "blocked", "suspended", "click", "link", "urgent",
  "won", "lottery", "prize", "reward", "refund", "cashback", "lucky",
  "account", "update", "expire", "penalty", "arrest", "customs", "parcel",
  "loan", "credit", "limited time", "act now", "share code", "pin",
];

function detectLanguage(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/\b(hai|kar|kya|aap|nahi|paisa|jaldi|karo|bhai)\b/i.test(text)) return "Hinglish";
  return "English";
}

function buildSignal(text: string): ScamSignal {
  const lower = text.toLowerCase();
  const links = Array.from(text.matchAll(URL_RE)).map((m) => m[0]);
  const amount = text.match(AMOUNT_RE)?.[0] ?? "";
  const hits = SCAM_TERMS.filter((t) => lower.includes(t));
  const sensitive = /\b(otp|pin|password|cvv|card number|upi pin|share code)\b/i.test(text);

  let category: ScamSignal["threat_category"] = "none";
  if (/\b(otp|pin|cvv|password)\b/i.test(text)) category = "otp_theft";
  else if (/\b(won|lottery|prize|lucky|reward)\b/i.test(text)) category = "lottery_prize";
  else if (/\b(loan|credit|emi)\b/i.test(text)) category = "job_loan_scam";
  else if (links.length && /\b(verify|kyc|update|blocked|click)\b/i.test(text)) category = "phishing";
  else if (amount || /\b(refund|cashback|transfer|upi)\b/i.test(text)) category = "financial";

  const urgency: ScamSignal["urgency"] =
    /\b(urgent|immediately|now|expire|24 hours|blocked|suspend)\b/i.test(text)
      ? "high"
      : hits.length > 2
        ? "medium"
        : hits.length > 0
          ? "low"
          : "none";

  return {
    message_type: /@/.test(text) ? "email" : links.length ? "sms" : "whatsapp",
    sender: "unknown",
    language: detectLanguage(text),
    links,
    amount,
    urgency,
    ask: hits.length ? `Message pushes you to: ${hits.slice(0, 3).join(", ")}` : "No clear ask detected",
    threat_category: category,
    contains_sensitive_request: sensitive,
  };
}

function scoreRisk(signal: ScamSignal, text: string): { level: RiskLevel; score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  if (signal.contains_sensitive_request) {
    score += 45;
    flags.push("Asks for a secret (OTP / PIN / password / card) — no legitimate org ever does this.");
  }
  if (signal.links.length) {
    score += 20;
    flags.push(`Contains a link (${signal.links[0]}) — verify the domain before tapping.`);
  }
  if (signal.urgency === "high") {
    score += 20;
    flags.push("Creates false urgency to make you act without thinking.");
  } else if (signal.urgency === "medium") {
    score += 10;
  }
  if (signal.threat_category === "lottery_prize") {
    score += 25;
    flags.push("Unexpected prize/lottery you never entered — classic bait.");
  }
  if (signal.threat_category === "otp_theft") {
    score += 15;
  }
  if (signal.amount) {
    score += 8;
    flags.push(`Mentions money (${signal.amount}).`);
  }
  if (/\b(kyc|blocked|suspend|expire|penalty|arrest|customs)\b/i.test(text)) {
    score += 12;
    flags.push("Threat/pressure tactic ('account blocked', 'penalty', etc.).");
  }

  score = Math.min(score, 98);
  const level: RiskLevel = score >= 60 ? "scam" : score >= 30 ? "suspicious" : "safe";
  if (level === "safe" && flags.length === 0) {
    flags.push("No obvious scam markers found — but stay cautious with unknown senders.");
  }
  return { level, score, flags };
}

function makeVerdict(signal: ScamSignal, level: RiskLevel, score: number, flags: string[]): Verdict {
  const headline =
    level === "scam"
      ? "Scam — do not respond or click."
      : level === "suspicious"
        ? "Suspicious — verify before you act."
        : "Looks safe — but stay alert.";

  const actions =
    level === "safe"
      ? ["No action needed.", "If in doubt, contact the organisation via their official number."]
      : [
          "Do NOT click any links or share OTP/PIN/passwords.",
          "Do not call back numbers given in the message.",
          "Verify directly with your bank/company using their official app or helpline.",
          level === "scam" ? "Report it: forward to 1930 / cybercrime.gov.in." : "Delete or ignore if unverified.",
        ];

  return {
    risk_level: level,
    confidence: Math.max(55, score),
    headline,
    explanation:
      level === "safe"
        ? "This message doesn't show the usual scam signals. There's no request for secrets and no high-pressure tactics. Still, never share OTPs or passwords with anyone."
        : `This message shows ${flags.length} warning sign(s) typical of ${signal.threat_category.replace(/_/g, " ")} scams. Genuine institutions never ask for OTPs, PINs, or passwords, and never rush you with threats.`,
    red_flags: flags,
    recommended_actions: actions,
  };
}

const MOCK_MODELS = ["mock/fast-8b", "mock/reasoner", "mock/multilingual"];

export async function mockAnalyze(text: string, mode: Mode): Promise<AnalysisResult> {
  const started = Date.now();
  const signal = buildSignal(text);

  // RAG: retrieve closest known scams and let a strong match refine the score.
  const retrieval = await retrieve(text);
  const topMatch: ScamMatch | undefined = retrieval.matches[0];

  const base = scoreRisk(signal, text);
  const ragBoost = topMatch ? Math.round((topMatch.similarity / 100) * 40) : 0;
  let score = Math.min(98, base.score + ragBoost);
  // A strong match to a known, currently-active scam is itself a decisive signal.
  if (topMatch && topMatch.similarity >= 70 && topMatch.status !== "classic") {
    score = Math.max(score, 68);
  }
  const flags = [...base.flags];
  if (topMatch && topMatch.similarity >= 40) {
    flags.unshift(`Matches a known "${topMatch.name}" (${topMatch.similarity}% similar to reported cases).`);
  }
  const level: RiskLevel = score >= 60 ? "scam" : score >= 30 ? "suspicious" : "safe";
  const verdict = makeVerdict(signal, level, score, flags);
  if (topMatch && topMatch.similarity >= 40 && level !== "safe") {
    verdict.explanation += ` This closely resembles the "${topMatch.name}" pattern. ${topMatch.advice}`;
  }

  // Simulate three models with slightly varied confidence to populate the panel.
  const opinions: ModelOpinion[] = MOCK_MODELS.map((m, i) => ({
    model: m,
    risk_level: level,
    confidence: Math.max(40, Math.min(99, score + (i - 1) * 6)),
    rationale:
      level === "safe"
        ? "No secret requested and no urgency; low risk."
        : `Flags ${signal.threat_category.replace(/_/g, " ")} pattern${topMatch ? ` ~ ${topMatch.name}` : ""}.`,
    latency_ms: 200 + i * 90,
    error: null,
  }));

  const plan = basePlan(mode);
  return {
    mode,
    mock: true,
    source: "text",
    signal,
    matches: retrieval.matches,
    retrieval: retrieval.info,
    intel: null,
    opinions,
    verdict,
    routing: {
      triage_model: plan.triage,
      triage_auto_routed: false,
      escalated: signal.contains_sensitive_request || signal.threat_category === "financial",
      resolved_models: MOCK_MODELS,
      fallback_used: false,
    },
    usage: opinions.map((o) => ({ model: o.model, step: "consensus", cost_usd: 0 })),
    total_latency_ms: Date.now() - started,
    mesh_features: retrieval.info.method === "embeddings" ? ["embeddings"] : [],
  };
}
