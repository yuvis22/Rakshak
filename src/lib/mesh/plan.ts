import { basePlan, type ModelPlan } from "./models";

/**
 * Resolve the model line-up for a run. Kept async so the pipeline can `await`
 * it (and so we can reintroduce live model discovery later without a signature
 * change). Currently returns the static tiered plan.
 */
export async function resolvePlan(): Promise<ModelPlan> {
  return basePlan();
}
