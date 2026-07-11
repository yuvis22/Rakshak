import type { FollowUpQuestion, QuestionAnswer, RiskLevel, ScamSignal } from "@/lib/types";

/**
 * Context questions. Message-only analysis can't see the phone call or the
 * panic behind a message, so Rakshak asks a few targeted questions and
 * re-scores with the answers. This is what separates a genuine OTP ("I just
 * logged in myself") from a scam ("someone on a call told me to read it out").
 */

const BANK: Record<string, FollowUpQuestion> = {
  initiated: {
    id: "initiated",
    question: "Did YOU just start this yourself (a login, payment, or signup)?",
    hint: "A code or request arriving out of nowhere is a red flag.",
    risky_answer: "no",
    weight: 25,
  },
  asking: {
    id: "asking",
    question: "Is anyone on a call or chat asking you to share, read out, or enter this code/details right now?",
    hint: "No genuine person or company ever needs your OTP/PIN.",
    risky_answer: "yes",
    weight: 45,
  },
  remote: {
    id: "remote",
    question: "Is any screen-sharing or remote-access app running (AnyDesk, TeamViewer, QuickSupport)?",
    hint: "Scammers use these to watch your screen and steal codes.",
    risky_answer: "yes",
    weight: 40,
  },
  sender: {
    id: "sender",
    question: "Do you recognise the sender's number or name?",
    risky_answer: "no",
    weight: 15,
  },
  pressure: {
    id: "pressure",
    question: "Were you promised money/a prize/refund, or threatened with a penalty, arrest, or account block?",
    risky_answer: "yes",
    weight: 25,
  },
  prior: {
    id: "prior",
    question: "Did you get any earlier calls or messages about this same matter?",
    hint: "Scammers often soften you up with prior contact.",
    risky_answer: "yes",
    weight: 15,
  },
};

/** Pick the most relevant questions for this message's intent/category. */
export function generateQuestions(signal: ScamSignal): FollowUpQuestion[] {
  let ids: string[];
  switch (signal.intent) {
    case "delivers_otp":
      ids = ["initiated", "asking", "remote"];
      break;
    case "requests_secret":
      ids = ["asking", "remote", "sender", "prior"];
      break;
    case "requests_money":
      ids = ["sender", "pressure", "prior"];
      break;
    default:
      if (["lottery_prize", "job_loan_scam"].includes(signal.threat_category)) ids = ["pressure", "sender", "prior"];
      else if (["phishing", "impersonation", "otp_theft"].includes(signal.threat_category))
        ids = ["asking", "sender", "prior", "remote"];
      else ids = ["initiated", "sender", "pressure"];
  }
  return ids.map((id) => BANK[id]).slice(0, 4);
}

/**
 * Re-score using the user's answers. Each answer carries its own risky_answer
 * and weight (from the original question, AI-generated or heuristic), so this
 * works regardless of how the questions were produced. Deterministic — used
 * offline and as a safety net around the live model re-assessment.
 */
export function applyAnswers(
  baseScore: number,
  answers: QuestionAnswer[],
): { score: number; level: RiskLevel; applied: string[] } {
  let score = baseScore;
  const applied: string[] = [];

  for (const a of answers) {
    if (a.answer === "unsure" || !a.risky_answer || a.weight == null) continue;
    const label = a.question ?? a.id;
    if (a.answer === a.risky_answer) {
      score += a.weight;
      applied.push(`⚠ ${label} → "${a.answer}"`);
    } else {
      score -= Math.round(a.weight * 0.5);
      applied.push(`✓ ${label} → "${a.answer}"`);
    }
  }

  score = Math.max(2, Math.min(98, score));
  const level: RiskLevel = score >= 60 ? "scam" : score >= 30 ? "suspicious" : "safe";
  return { score, level, applied };
}
