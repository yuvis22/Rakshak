import type { RiskLevel } from "@/lib/types";

export const riskMeta: Record<
  RiskLevel,
  { label: string; color: string; bg: string; border: string; emoji: string }
> = {
  safe: { label: "Safe", color: "#2fd27a", bg: "rgba(47,210,122,0.10)", border: "rgba(47,210,122,0.35)", emoji: "✓" },
  suspicious: { label: "Suspicious", color: "#f5b400", bg: "rgba(245,180,0,0.10)", border: "rgba(245,180,0,0.35)", emoji: "!" },
  scam: { label: "Scam", color: "#ff5470", bg: "rgba(255,84,112,0.12)", border: "rgba(255,84,112,0.40)", emoji: "✕" },
};
