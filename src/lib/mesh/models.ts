/**
 * The model line-up for a run. It carries BOTH tiers (cheap + premium) so the
 * pipeline can start cheap and escalate to premium only when the check is hard
 * or high-stakes — automatic cost optimization, no user-facing modes.
 */
export interface ModelPlan {
  extractor: string; // cheap structured-output model for signal extraction
  triage: string; // Mesh auto-routed triage pass
  cheapConsensus: string[]; // fast, low-cost models for the first pass
  premiumConsensus: string[]; // heavyweight models used only on escalation
  cheapAggregator: string; // cheap synthesiser
  premiumAggregator: string; // premium synthesiser (on escalation)
  vision: string; // multimodal model for screenshots
  dynamic: boolean;
}

/**
 * Model tiers verified against GET /v1/models (supports_structured_output +
 * live pricing). Cheap models cost fractions of a paisa; premium models are the
 * recognizable heavyweights that make the consensus panel compelling.
 */
export const PLAN: ModelPlan = {
  extractor: "google/gemini-2.5-flash-lite", // struct=true, ~$0.0001/1k
  triage: "meta-llama/meta-llama-3.1-8b-instruct", // ~$0.00002/1k
  cheapConsensus: ["mistralai/mistral-nemo", "google/gemini-2.5-flash-lite"], // fast + 2 providers
  premiumConsensus: ["openai/gpt-4o", "anthropic/claude-haiku-4.5"],
  cheapAggregator: "google/gemini-2.5-flash-lite", // struct=true
  premiumAggregator: "google/gemini-2.5-flash", // struct=true, fast + capable
  vision: "google/gemini-2.5-flash", // image input, cheap
  dynamic: false,
};

export function basePlan(): ModelPlan {
  return { ...PLAN };
}
