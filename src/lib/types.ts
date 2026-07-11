import { z } from "zod";



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
  intent: z
    .enum(["delivers_otp", "requests_secret", "requests_money", "requests_action", "informational", "unknown"])
    .describe(
      "The message's intent. 'delivers_otp' = it is SENDING a code/OTP to the user (usually legitimate). " +
        "'requests_secret' = it ASKS the user to share/enter an OTP/PIN/password/card (scam). " +
        "'requests_money' = asks to pay/transfer. 'requests_action' = click/call/install. 'informational' = no ask.",
    ),
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
    .describe(
      "True ONLY if the message ASKS the user to share/enter a secret (OTP/PIN/password/card). " +
        "A message that merely DELIVERS an OTP to the user is NOT a sensitive request — set this false.",
    ),
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

/** A context question Rakshak asks the user to refine an ambiguous verdict. */
export interface FollowUpQuestion {
  id: string;
  question: string;
  hint?: string;
  risky_answer: "yes" | "no"; // the answer that raises risk
  weight: number; // score delta applied on the risky answer
}

/**
 * A user's answer to a follow-up question. Carries the question metadata so
 * re-assessment works even when questions were AI-generated per message
 * (no need to regenerate/match by id).
 */
export interface QuestionAnswer {
  id: string;
  answer: "yes" | "no" | "unsure";
  question?: string;
  risky_answer?: "yes" | "no";
  weight?: number;
}

/** One answered turn in the multi-turn context conversation. */
export interface ConversationTurn {
  id: string;
  question: string;
  answer: "yes" | "no" | "unsure";
  risky_answer?: "yes" | "no";
  weight?: number;
}

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

/** Response of a conversation round: ask a batch of questions, or decide. */
export type ConverseResponse =
  | { action: "ask"; questions: FollowUpQuestion[]; round: number; note?: string }
  | { action: "decide"; verdict: Verdict; applied: string[]; round: number };

/** Server-sent events emitted while an analysis runs (streaming endpoint). */
export type StreamEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "opinion"; opinion: ModelOpinion }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; message: string };

/** Full analysis response returned by /api/analyze. */
export interface AnalysisResult {
  mock: boolean;
  source: "text" | "image" | "audio"; // text, screenshot (vision), or voice note (STT)
  analyzed_text: string; // the text actually analysed (post-transcription for media)
  signal: ScamSignal;
  questions: FollowUpQuestion[]; // context questions to refine the verdict
  matches: ScamMatch[];
  retrieval: RetrievalInfo;
  intel: WebIntel | null;
  opinions: ModelOpinion[];
  verdict: Verdict;
  routing: {
    triage_model: string;
    triage_auto_routed: boolean; // true when Mesh Auto-Router chose the model
    escalated: boolean;
    escalation_reason?: string; // why we escalated to premium models
    tier: "cheap" | "premium" | "mixed"; // which model tier(s) served this check
    router_selected?: string; // model chosen by Mesh /v1/router/select on escalation
    resolved_models: string[];
    fallback_used: boolean;
    fallback_note?: string;
  };
  usage: UsageEvent[];
  total_latency_ms: number;
  mesh_features: string[]; // which Mesh capabilities this run exercised
}
