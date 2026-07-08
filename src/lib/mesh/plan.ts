import type { Mode } from "@/lib/types";
import { basePlan, type ModelPlan } from "./models";
import { isLive, listModels } from "./client";

let freeCache: { at: number; models: string[]; structured: string[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/**
 * Resolve the model line-up for a run.
 * - paid: curated premium list.
 * - free (live key): discovered from /v1/models/free so it always uses real
 *   zero-cost IDs, picking a structured-output-capable model as the extractor
 *   and up to 3 distinct models for the consensus panel.
 * - free (mock): static defaults.
 */
export async function resolvePlan(mode: Mode): Promise<ModelPlan> {
  const plan = basePlan(mode);
  if (mode === "paid" || !isLive()) return plan;

  try {
    if (!freeCache || Date.now() - freeCache.at > CACHE_MS) {
      const models = await listModels(true);
      const usable = models.filter((m) => m.supports_completions_api !== false);
      freeCache = {
        at: Date.now(),
        models: usable.map((m) => m.id),
        structured: usable.filter((m) => m.supports_structured_output).map((m) => m.id),
      };
    }
    const all = freeCache.models;
    if (all.length === 0) return plan;

    const extractor = freeCache.structured[0] ?? all[0];
    const consensus = dedupe([extractor, ...all]).slice(0, Math.min(3, all.length));
    return {
      ...plan,
      dynamic: true,
      extractor,
      triage: all[0],
      escalation: freeCache.structured[0] ?? all[0],
      consensus,
      aggregator: freeCache.structured[0] ?? all[0],
    };
  } catch {
    // If discovery fails, fall back to static defaults rather than breaking the run.
    return plan;
  }
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
