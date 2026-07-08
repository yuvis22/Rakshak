import type { Mode } from "@/lib/types";

/**
 * A resolved set of models for one analysis run.
 * The same shape is used for both free and paid modes so the pipeline
 * code never branches on mode — only the model IDs change.
 */
export interface ModelPlan {
  mode: Mode;
  extractor: string; // structured extraction (needs structured-output support)
  triage: string; // cheap first-pass classifier ("cheapest that works")
  escalation: string; // strong model for sensitive/financial cases
  consensus: string[]; // 2-4 models fanned out for the verdict panel
  aggregator: string; // synthesizes the final verdict from opinions
  vision: string; // multimodal model for screenshot/image input
  dynamic: boolean; // true if resolved live from /v1/models/free
}

/**
 * PAID mode: recognizable heavyweight models. This is the lineup that makes
 * the multi-model consensus panel impressive for the demo video.
 * Extractor/aggregator use structured-output-capable models (verified via the
 * `supports_structured_output` flag on GET /v1/models).
 */
export const PAID_PLAN: ModelPlan = {
  mode: "paid",
  extractor: "google/gemini-2.5-flash", // struct=true
  triage: "openai/gpt-4o-mini",
  escalation: "anthropic/claude-haiku-4.5", // struct=true
  consensus: ["openai/gpt-4o", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash"],
  aggregator: "openai/gpt-5", // struct=true
  vision: "openai/gpt-4o", // image input
  dynamic: false,
};

/**
 * FREE mode = lowest-cost line-up. NOTE: this Mesh account exposes no truly
 * zero-cost models (GET /v1/models/free is empty), so "free" here means the
 * cheapest available models — fractions of a paisa per call. If real free
 * models ever appear, resolvePlan() will discover and prefer them automatically.
 */
export const FREE_PLAN_DEFAULTS: ModelPlan = {
  mode: "free",
  extractor: "google/gemini-2.5-flash-lite", // struct=true, ~$0.0001/1k
  triage: "meta-llama/meta-llama-3.1-8b-instruct", // ~$0.00002/1k
  escalation: "google/gemini-2.5-flash", // struct=true
  consensus: [
    "meta-llama/meta-llama-3.1-8b-instruct",
    "mistralai/mistral-nemo",
    "google/gemini-2.5-flash-lite",
  ],
  aggregator: "google/gemini-2.5-flash-lite", // struct=true
  vision: "google/gemini-2.5-flash", // image input, cheap
  dynamic: false,
};

export function basePlan(mode: Mode): ModelPlan {
  return mode === "paid" ? { ...PAID_PLAN } : { ...FREE_PLAN_DEFAULTS };
}
