import { z } from "zod";

/** Free = zero-cost models (dev/testing). Paid = premium models (best results / demo). */
export type Mode = "free" | "paid";

/** Structured signal extracted from a raw message before we judge it. */
export const ScamSignalSchema = z.object({
  message_type: z
    .enum(["sms", "email", "whatsapp", "call_transcript", "upi_request", "other"])
    .describe("What kind of message this looks like"),
  sender: z.string().describe("Sender name/number/email if present, else 'unknown'"),
  language: z.string().describe("Detected language, e.g. 'Hindi', 'Hinglish', 'English'"),
  links: z.array(z.string()).describe("Any URLs found in the message"),
  amount: z.string().describe("Any money amount mentioned, else empty string"),
  urgency: z.enum(["none", "low", "medium", "high"]).describe("How much pressure/urgency the message creates"),
  ask: z.string().describe("What the message wants the user to do"),
  threat_category: z
    .enum([
      "financial",
      "phishing",
      "otp_theft",
      "lottery_prize",
      "job_loan_scam",
      "impersonation",
      "misinformation",
      "none",
      "other",
    ])
    .describe("Best-guess category of the potential threat"),
  contains_sensitive_request: z
    .boolean()
    .describe("True if it asks for OTP, password, bank/card details, or money transfer"),
});
export type ScamSignal = z.infer<typeof ScamSignalSchema>;

export const RiskLevel = z.enum(["safe", "suspicious", "scam"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

/** A single model's independent opinion, shown in the consensus panel. */
export const ModelOpinionSchema = z.object({
  model: z.string(),
  risk_level: RiskLevel,
  confidence: z.number().min(0).max(100),
  rationale: z.string(),
  latency_ms: z.number().optional(),
  error: z.string().nullable().optional(),
});
export type ModelOpinion = z.infer<typeof ModelOpinionSchema>;

/** The final synthesized verdict shown to the user. */
export const VerdictSchema = z.object({
  risk_level: RiskLevel,
  confidence: z.number().min(0).max(100),
  headline: z.string().describe("One-line verdict in the user's language"),
  explanation: z.string().describe("Plain-language why, in the user's language"),
  red_flags: z.array(z.string()),
  recommended_actions: z.array(z.string()),
});
export type Verdict = z.infer<typeof VerdictSchema>;

/** A known scam pattern matched from the knowledge base (RAG). */
export interface ScamMatch {
  id: string;
  name: string;
  category: string;
  status: "ongoing" | "trending" | "classic";
  similarity: number; // 0-100
  advice: string;
}

/** How the RAG retrieval was performed for this run. */
export interface RetrievalInfo {
  method: "embeddings" | "lexical";
  model?: string; // embedding model, when method === "embeddings"
  corpus_size: number;
  top_similarity: number;
}

/** Live web intelligence gathered via Mesh Web Search. */
export interface WebIntel {
  query: string;
  answer: string | null;
  sources: { title: string; url: string }[];
}

/** Per-model billing/usage info surfaced in the cost strip. */
export interface UsageEvent {
  model: string;
  step: string;
  cost_usd: number | null;
}

/** Full analysis response returned by /api/analyze. */
export interface AnalysisResult {
  mode: Mode;
  mock: boolean;
  source: "text" | "image"; // whether input came from a screenshot (vision)
  signal: ScamSignal;
  matches: ScamMatch[];
  retrieval: RetrievalInfo;
  intel: WebIntel | null;
  opinions: ModelOpinion[];
  verdict: Verdict;
  routing: {
    triage_model: string;
    triage_auto_routed: boolean; // true when Mesh Auto-Router chose the model
    escalated: boolean;
    resolved_models: string[];
    fallback_used: boolean;
    fallback_note?: string;
  };
  usage: UsageEvent[];
  total_latency_ms: number;
  mesh_features: string[]; // which Mesh capabilities this run exercised
}
