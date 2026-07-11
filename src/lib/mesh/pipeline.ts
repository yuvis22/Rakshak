import {
  type AnalysisResult,
  type ModelOpinion,
  ModelOpinionSchema,
  type RiskLevel,
  type ScamSignal,
  ScamSignalSchema,
  type Verdict,
  VerdictSchema,
} from "@/lib/types";
import {
  chat,
  chatWithFallback,
  compare,
  compareStream,
  isLive,
  MeshError,
  routerSelect,
  transcribe,
  webSearch,
  type ChatMessage,
} from "./client";
import type { StreamEvent, WebIntel } from "@/lib/types";
import { fenceUntrusted, INJECTION_GUARD } from "@/lib/security";
import { generateQuestions } from "@/lib/questions";
import type { ConversationTurn, ConverseResponse, FollowUpQuestion, QuestionAnswer } from "@/lib/types";

/** Sarvam STT — optimised for Indian languages (Hindi, Hinglish, regional). */
const STT_MODEL = "sarvam/saaras:v3";
import { mockAnalyze, mockConverse, mockReassess } from "./mock";
import { resolvePlan } from "./plan";
import type { ModelPlan } from "./models";
import { retrieve } from "@/lib/knowledge/retrieval";

/* ---------- JSON schemas for structured output (mirror the zod types) ---------- */

const SIGNAL_SCHEMA = {
  type: "object",
  properties: {
    message_type: { type: "string", enum: ["sms", "email", "whatsapp", "call_transcript", "upi_request", "other"] },
    sender: { type: "string" },
    language: { type: "string" },
    links: { type: "array", items: { type: "string" } },
    amount: { type: "string" },
    urgency: { type: "string", enum: ["none", "low", "medium", "high"] },
    ask: { type: "string" },
    intent: {
      type: "string",
      enum: ["delivers_otp", "requests_secret", "requests_money", "requests_action", "informational", "unknown"],
    },
    threat_category: {
      type: "string",
      enum: ["financial", "phishing", "otp_theft", "lottery_prize", "job_loan_scam", "impersonation", "misinformation", "none", "other"],
    },
    contains_sensitive_request: { type: "boolean" },
  },
  required: ["message_type", "sender", "language", "links", "amount", "urgency", "ask", "intent", "threat_category", "contains_sensitive_request"],
  additionalProperties: false,
} as const;

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["safe", "suspicious", "scam"] },
    confidence: { type: "number" },
    headline: { type: "string" },
    explanation: { type: "string" },
    red_flags: { type: "array", items: { type: "string" } },
    recommended_actions: { type: "array", items: { type: "string" } },
  },
  required: ["risk_level", "confidence", "headline", "explanation", "red_flags", "recommended_actions"],
  additionalProperties: false,
} as const;

const CONVERSE_SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["ask", "decide"] },
    note: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          hint: { type: "string" },
          risky_answer: { type: "string", enum: ["yes", "no"] },
          weight: { type: "number" },
        },
        required: ["id", "question", "risky_answer", "weight"],
        additionalProperties: false,
      },
    },
    verdict: VERDICT_SCHEMA,
  },
  required: ["action"],
  additionalProperties: false,
} as const;

/* ---------- helpers ---------- */

/** Normalise confidence to 0-100 (some models answer on a 0-1 scale). */
function normConfidence(c: number): number {
  if (!Number.isFinite(c)) return 50;
  const v = c > 0 && c <= 1 ? c * 100 : c;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Pull the first JSON object out of a model response, tolerating prose/markdown fences. */
function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.replace(/```json|```/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function needsEscalation(signal: ScamSignal): boolean {
  return (
    signal.contains_sensitive_request ||
    ["financial", "otp_theft", "phishing", "impersonation"].includes(signal.threat_category)
  );
}

/* ---------- steps ---------- */

/** Vision: OCR/transcribe a screenshot of a message into plain text via a multimodal model. */
async function transcribeImage(dataUrl: string, plan: ModelPlan): Promise<string> {
  const res = await chat({
    model: plan.vision,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe ALL text visible in this screenshot of a message (SMS/WhatsApp/email) exactly, including sender, numbers, and links. Output only the transcribed text, no commentary.",
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return res.content.trim();
}

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          hint: { type: "string" },
          risky_answer: { type: "string", enum: ["yes", "no"] },
          weight: { type: "number" },
        },
        required: ["id", "question", "risky_answer", "weight"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

/**
 * AI-generated context questions, tailored to THIS message. Each question is a
 * yes/no whose answer would most change the verdict, with a risky_answer and a
 * weight (10-45) so offline re-scoring still works. Falls back to the heuristic
 * bank if the model call fails.
 */
async function generateQuestionsLive(text: string, signal: ScamSignal, plan: ModelPlan): Promise<FollowUpQuestion[]> {
  try {
    const res = await chat({
      model: plan.extractor,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "context_questions", schema: QUESTIONS_SCHEMA } },
      messages: [
        {
          role: "system",
          content:
            "You are a fraud analyst. Generate 2-4 SHORT yes/no questions about the user's CONTEXT (not the message text) whose answers would most change whether this is a scam — e.g. did they initiate it, is someone pressuring them to share a code, is a remote-access app running, do they know the sender. " +
            "Tailor the questions to THIS specific message. For each: set risky_answer to the answer indicating higher risk, and weight 10-45 by how decisive it is. Write in the user's language (" + signal.language + "). Return schema JSON. " +
            INJECTION_GUARD,
        },
        { role: "user", content: `Signal:\n${JSON.stringify(signal)}\n\nMessage:\n${fenceUntrusted(text)}` },
      ],
    });
    const parsed = parseJson<{ questions: FollowUpQuestion[] }>(res.content);
    const qs = (parsed?.questions ?? [])
      .filter((q) => q && q.question && (q.risky_answer === "yes" || q.risky_answer === "no"))
      .slice(0, 4)
      .map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: String(q.question),
        hint: q.hint ? String(q.hint) : undefined,
        risky_answer: q.risky_answer,
        weight: Math.max(5, Math.min(45, Number(q.weight) || 20)),
      }));
    if (qs.length > 0) return qs;
  } catch {
    /* fall back to heuristic */
  }
  return generateQuestions(signal);
}

/**
 * Auto-Routing: ask Mesh's router which model best fits this message WITHOUT
 * running inference (/v1/router/select). Fast (no tokens) and shows the router
 * choice on every check.
 */
async function triageAuto(text: string): Promise<{ model: string; auto_routed: boolean }> {
  try {
    const sel = await routerSelect({ messages: [{ role: "user", content: text.slice(0, 1500) }] });
    return { model: sel.model || "auto", auto_routed: Boolean(sel.model) };
  } catch {
    return { model: "auto (unavailable)", auto_routed: false };
  }
}

/** Web Search: gather live intel about the sender/link/claim to check for reported scams. */
async function gatherIntel(signal: ScamSignal, text: string): Promise<WebIntel | null> {
  // Only search when there's something concrete worth checking.
  const domain = signal.links[0]?.replace(/^https?:\/\//, "").split(/[/?]/)[0];
  const subject = domain || (signal.sender && signal.sender !== "unknown" ? signal.sender : "");
  const hook = text.slice(0, 100).replace(/\s+/g, " ");
  const query = `Is this a known scam in India? ${subject ? subject + " — " : ""}"${hook}"`;
  try {
    const r = await webSearch({ query, include_answer: true, max_results: 4 });
    return {
      query,
      answer: r.answer,
      sources: r.results.slice(0, 4).map((x) => ({ title: x.title, url: x.url })),
    };
  } catch {
    return null;
  }
}

async function extractSignal(text: string, plan: ModelPlan): Promise<ScamSignal> {
  const res = await chat({
    model: plan.extractor,
    temperature: 0,
    response_format: { type: "json_schema", json_schema: { name: "scam_signal", schema: SIGNAL_SCHEMA } },
    messages: [
      {
        role: "system",
        content:
          "You extract structured signals from a possibly-fraudulent message (SMS/WhatsApp/email) common in India. Reply ONLY with the schema JSON. Detect the language (English/Hindi/Hinglish). " +
          "CRUCIAL: distinguish a message that DELIVERS an OTP/code to the user (intent 'delivers_otp', usually legitimate, contains_sensitive_request=false) from one that ASKS the user to share/enter an OTP/PIN/password/card (intent 'requests_secret', a scam, contains_sensitive_request=true). Merely containing the word 'OTP' or a code is NOT a scam by itself. " +
          INJECTION_GUARD,
      },
      { role: "user", content: fenceUntrusted(text) },
    ],
  });
  const parsed = parseJson<ScamSignal>(res.content);
  const safe = ScamSignalSchema.safeParse(parsed);
  if (safe.success) return safe.data;
  // Minimal fallback so the pipeline continues even if extraction is malformed.
  return {
    message_type: "other",
    sender: "unknown",
    language: "unknown",
    links: [],
    amount: "",
    urgency: "none",
    ask: "unknown",
    intent: "unknown",
    threat_category: "none",
    contains_sensitive_request: false,
  };
}

function opinionMessages(text: string, signal: ScamSignal, context: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a fraud-detection reviewer for Indian users. Judge whether a message is a scam. " +
        "Reply ONLY as JSON: {\"risk_level\":\"safe|suspicious|scam\",\"confidence\":0-100,\"rationale\":\"one sentence\"}. " +
        "Treat requests for OTP/PIN/passwords, unexpected prizes, KYC-blocking threats, and suspicious links as strong scam signals. " +
        "Use the retrieved known-scam patterns as evidence, but judge the message on its own merits. " +
        INJECTION_GUARD,
    },
    {
      role: "user",
      content:
        `Known scam patterns matched from our database (RAG):\n${context}\n\n` +
        `Extracted signal:\n${JSON.stringify(signal)}\n\nMessage to analyse:\n${fenceUntrusted(text)}`,
    },
  ];
}

function toOpinion(model: string, content: string, latency?: number, error?: string | null): ModelOpinion {
  if (error) {
    return { model, risk_level: "suspicious", confidence: 0, rationale: `Model error: ${error}`, latency_ms: latency, error };
  }
  const parsed = parseJson<Partial<ModelOpinion>>(content);
  const candidate = { model, latency_ms: latency, error: null, ...parsed };
  if (typeof candidate.confidence === "number") candidate.confidence = normConfidence(candidate.confidence);
  const safe = ModelOpinionSchema.safeParse(candidate);
  if (safe.success) return safe.data;
  return {
    model,
    risk_level: "suspicious",
    confidence: 40,
    rationale: content ? content.slice(0, 160) : "Unparseable response.",
    latency_ms: latency,
    error: null,
  };
}

/**
 * Streaming variant: fire each model in parallel and emit its opinion the moment
 * it resolves, so the consensus panel fills in live. Used by the SSE endpoint.
 */
async function gatherOpinionsStreaming(
  text: string,
  signal: ScamSignal,
  models: string[],
  context: string,
  emit: (op: ModelOpinion) => void,
): Promise<{ opinions: ModelOpinion[]; partial: boolean; usedCompare: boolean }> {
  const messages = opinionMessages(text, signal, context);

  // Preferred path: Mesh native compare streaming (SSE fan-out).
  try {
    const opinions: ModelOpinion[] = [];
    const { partial } = await compareStream({ models, messages, temperature: 0 }, (r) => {
      const op = toOpinion(r.model, r.content, r.latency_ms, r.error);
      opinions.push(op);
      emit(op);
    });
    if (opinions.length > 0) return { opinions, partial, usedCompare: true };
  } catch {
    /* fall back to parallel single calls below */
  }

  // Fallback: fire each model individually in parallel, emit as they resolve.
  const opinions = await Promise.all(
    models.map(async (m) => {
      let op: ModelOpinion;
      try {
        const r = await chat({ model: m, messages, temperature: 0 });
        op = toOpinion(r.model, r.content, r.latency_ms);
      } catch (err) {
        op = toOpinion(m, "", undefined, err instanceof Error ? err.message : "failed");
      }
      emit(op);
      return op;
    }),
  );
  return { opinions, partial: opinions.some((o) => o.error), usedCompare: false };
}

async function gatherOpinions(
  text: string,
  signal: ScamSignal,
  models: string[],
  context: string,
): Promise<{ opinions: ModelOpinion[]; partial: boolean }> {
  const messages = opinionMessages(text, signal, context);
  try {
    const { results, partial } = await compare({ models, messages, temperature: 0 });
    return {
      opinions: results.map((r) => toOpinion(r.model, r.content, r.latency_ms, r.error)),
      partial,
    };
  } catch {
    // Compare endpoint failed — fall back to sequential single calls so we still get a verdict.
    const opinions: ModelOpinion[] = [];
    for (const m of models) {
      try {
        const r = await chat({ model: m, messages, temperature: 0 });
        opinions.push(toOpinion(r.model, r.content, r.latency_ms));
      } catch (err) {
        opinions.push(toOpinion(m, "", undefined, err instanceof Error ? err.message : "failed"));
      }
    }
    return { opinions, partial: true };
  }
}

/** Local majority synthesis, used if the aggregator model call fails. */
function localAggregate(signal: ScamSignal, opinions: ModelOpinion[]): Verdict {
  const valid = opinions.filter((o) => !o.error);
  const rank: Record<RiskLevel, number> = { safe: 0, suspicious: 1, scam: 2 };
  const worst = valid.reduce<RiskLevel>((acc, o) => (rank[o.risk_level] > rank[acc] ? o.risk_level : acc), "safe");
  const avg = valid.length ? Math.round(valid.reduce((s, o) => s + o.confidence, 0) / valid.length) : 50;
  const flags: string[] = [];
  if (signal.contains_sensitive_request) flags.push("Requests a secret (OTP/PIN/password/card details).");
  if (signal.links.length) flags.push(`Contains a link: ${signal.links[0]}`);
  if (signal.urgency === "high") flags.push("Uses high-pressure urgency.");
  return {
    risk_level: worst,
    confidence: avg,
    headline:
      worst === "scam" ? "Scam — do not respond or click." : worst === "suspicious" ? "Suspicious — verify first." : "Looks safe — stay alert.",
    explanation: `${valid.length} models reviewed this message and the consensus risk is "${worst}".`,
    red_flags: flags.length ? flags : ["No strong scam markers detected."],
    recommended_actions:
      worst === "safe"
        ? ["No action needed. Verify via official channels if unsure."]
        : ["Do not share OTP/PIN/passwords.", "Do not click links.", "Verify with your bank's official helpline.", "Report to 1930 / cybercrime.gov.in."],
  };
}

async function synthesize(
  text: string,
  signal: ScamSignal,
  opinions: ModelOpinion[],
  aggregator: string,
  context: string,
): Promise<Verdict> {
  try {
    const res = await chat({
      model: aggregator,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "verdict", schema: VERDICT_SCHEMA } },
      messages: [
        {
          role: "system",
          content:
            "You are the lead fraud analyst. Given a structured signal, retrieved known-scam patterns, and several models' opinions, produce ONE final verdict as schema JSON. " +
            "Write headline and explanation in the user's language (" + signal.language + "). " +
            "Ground your reasoning in the matched known-scam patterns when relevant. " +
            "Be decisive but never give false reassurance: frame as risk assessment, not a guarantee. " +
            "recommended_actions must be concrete and safety-first. " +
            INJECTION_GUARD,
        },
        {
          role: "user",
          content: `Known scam patterns matched (RAG):\n${context}\n\nSignal:\n${JSON.stringify(signal)}\n\nModel opinions:\n${JSON.stringify(
            opinions.map((o) => ({ model: o.model, risk: o.risk_level, confidence: o.confidence, why: o.rationale })),
          )}\n\nMessage to analyse:\n${fenceUntrusted(text)}`,
        },
      ],
    });
    const parsed = parseJson<Verdict>(res.content);
    const safe = VerdictSchema.safeParse(parsed);
    if (safe.success) return { ...safe.data, confidence: normConfidence(safe.data.confidence) };
  } catch {
    /* fall through to local aggregate */
  }
  return localAggregate(signal, opinions);
}

/* ---------- entry point ---------- */

export interface AnalyzeOptions {
  /** Force a model to fail first to demonstrate Mesh fallback (UI toggle). */
  forceFallback?: boolean;
  /** Data-URL of a screenshot to analyse via Mesh vision. */
  image?: string;
  /** Data-URL of a voice note to transcribe via Mesh speech-to-text. */
  audio?: string;
  /** Optional event sink for streaming progress (SSE endpoint). */
  emit?: (ev: StreamEvent) => void;
}

export async function analyze(text: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const live = isLive() && process.env.MESH_FORCE_MOCK !== "1";

  // Screenshot / voice-note analysis needs live models — there's no offline OCR/STT.
  if (opts.image && !live) {
    throw new MeshError(402, "Screenshot analysis needs a Mesh balance. Paste the text instead, or top up ₹100.");
  }
  if (opts.audio && !live) {
    throw new MeshError(402, "Voice-note analysis needs a Mesh balance. Paste the text instead, or top up ₹100.");
  }

  // No key configured, or explicit override → offline heuristic engine.
  if (!live) return mockAnalyze(text, opts.emit);

  try {
    return await analyzeLive(text, opts);
  } catch (err) {
    // Graceful degradation: if the account has no balance, keep the app fully
    // usable for dev/demo via the mock engine rather than a hard error.
    if (err instanceof MeshError && err.status === 402) {
      if (opts.image || opts.audio) throw err; // can't mock-analyse media
      const fallback = await mockAnalyze(text, opts.emit);
      fallback.routing.fallback_note =
        "Mesh balance is ₹0 — ran the built-in offline engine. Top up ₹100 to use live models.";
      return fallback;
    }
    throw err;
  }
}

async function analyzeLive(inputText: string, opts: AnalyzeOptions): Promise<AnalysisResult> {
  const started = Date.now();
  const plan = await resolvePlan();
  const meshFeatures = new Set<string>(["chat.completions", "structured-output"]);
  const emit = opts.emit;
  const stage = (s: string, label: string) => emit?.({ type: "stage", stage: s, label });

  // Media input: transcribe a screenshot (vision) or voice note (STT) to text first.
  let text = inputText;
  let source: "text" | "image" | "audio" = "text";
  if (opts.image) {
    stage("input", "Reading screenshot with Mesh vision…");
    text = await transcribeImage(opts.image, plan);
    source = "image";
    meshFeatures.add("vision");
  } else if (opts.audio) {
    stage("input", "Transcribing voice note (Sarvam via Mesh)…");
    text = await transcribe(opts.audio, STT_MODEL);
    source = "audio";
    meshFeatures.add("speech-to-text");
  }

  // RAG: retrieve the closest known scam patterns to ground the judgment.
  // Run the independent first steps in parallel: structured extraction, RAG
  // retrieval and the auto-routed triage don't depend on one another.
  stage("extract", "Extracting signal, matching patterns, routing…");
  const [signal, retrieval, triage] = await Promise.all([
    extractSignal(text, plan),
    retrieve(text),
    triageAuto(text),
  ]);
  if (retrieval.info.method === "embeddings") meshFeatures.add("embeddings");
  if (triage.auto_routed) {
    meshFeatures.add("auto-routing");
    meshFeatures.add("router-select");
  }
  const highStakes = needsEscalation(signal);
  let escalated = false;

  // Web Search: only when there's something concrete to check (link, named
  // sender, or high-stakes). Run it in parallel with the cheap consensus so it
  // never sits on the critical path.
  const wantIntel =
    signal.links.length > 0 || highStakes || !["none", "other"].includes(signal.threat_category);
  const intelPromise: Promise<WebIntel | null> = wantIntel ? gatherIntel(signal, text) : Promise.resolve(null);

  let fallbackNote: string | undefined;
  let fallbackUsed = false;

  // Fallback demo: force a bad model first and rely on rerouting resilience.
  if (opts.forceFallback) {
    const badModel = "does-not-exist/offline-model";
    try {
      await chatWithFallback([badModel, plan.cheapConsensus[0]], {
        messages: opinionMessages(text, signal, retrieval.context),
        temperature: 0,
      });
      fallbackUsed = true;
      fallbackNote = `Primary model failed; Mesh rerouted to ${plan.cheapConsensus[0]} with zero downtime.`;
    } catch {
      /* ignore */
    }
  }

  // Runs a consensus over a set of models (streaming or batched).
  const runConsensus = async (models: string[], ctx: string) => {
    if (emit) {
      const r = await gatherOpinionsStreaming(text, signal, models, ctx, (op) => emit({ type: "opinion", opinion: op }));
      meshFeatures.add(r.usedCompare ? "compare" : "chat.completions");
      return r;
    }
    const r = await gatherOpinions(text, signal, models, ctx);
    meshFeatures.add("compare");
    return { ...r, usedCompare: true };
  };

  // ---- Cost optimization: cheap-first, escalate only when needed ----
  stage("consensus", "Asking the fast, low-cost models first…");
  const first = await runConsensus(plan.cheapConsensus, retrieval.context);
  let opinions: ModelOpinion[] = first.opinions;
  let partial = first.partial;

  // Web-search intel was running in parallel; fold it into the synthesis context.
  const intel = await intelPromise;
  if (intel) meshFeatures.add("web-search");
  const context = intel?.answer ? `${retrieval.context}\n\nLive web intel: ${intel.answer}` : retrieval.context;

  const valid = opinions.filter((o) => !o.error);
  const disagree = new Set(valid.map((o) => o.risk_level)).size > 1;
  const avgConf = valid.length ? valid.reduce((s, o) => s + o.confidence, 0) / valid.length : 0;
  const borderline = valid.some((o) => o.risk_level === "suspicious") || avgConf < 65;

  const reasons: string[] = [];
  if (highStakes) reasons.push("high-stakes content (money / secret / impersonation)");
  if (disagree) reasons.push("the fast models disagreed");
  if (borderline) reasons.push("borderline confidence");

  let tier: "cheap" | "premium" | "mixed" = "cheap";
  let escalationReason: string | undefined;
  let routerSelected: string | undefined;
  let aggregator = plan.cheapAggregator;

  if (reasons.length > 0) {
    escalated = true;
    escalationReason = reasons.join(", ");
    stage("escalate", `Escalating to premium models (${escalationReason})…`);

    // Let Mesh's router pick the best escalation model (excluding the cheap ones).
    let premiumModels = plan.premiumConsensus;
    try {
      const sel = await routerSelect({
        messages: opinionMessages(text, signal, context),
        exclude_models: plan.cheapConsensus,
      });
      meshFeatures.add("router-select");
      if (sel.model) {
        routerSelected = sel.model;
        premiumModels = Array.from(new Set([sel.model, ...plan.premiumConsensus])).slice(0, 2);
      }
    } catch {
      /* use the default premium pair */
    }

    const second = await runConsensus(premiumModels, context);
    opinions = [...opinions, ...second.opinions];
    partial = partial || second.partial;
    tier = "mixed";
    aggregator = plan.premiumAggregator;
  }
  if (partial) fallbackUsed = true;

  stage("verdict", "Synthesizing the final verdict…");
  const [verdict, questions] = await Promise.all([
    synthesize(text, signal, opinions, aggregator, context),
    generateQuestionsLive(text, signal, plan),
  ]);

  return {
    mock: false,
    source,
    analyzed_text: text,
    signal,
    questions,
    matches: retrieval.matches,
    retrieval: retrieval.info,
    intel,
    opinions,
    verdict,
    routing: {
      triage_model: triage.model,
      triage_auto_routed: triage.auto_routed,
      escalated,
      escalation_reason: escalationReason,
      tier,
      router_selected: routerSelected,
      resolved_models: opinions.map((o) => o.model),
      fallback_used: fallbackUsed,
      fallback_note: fallbackNote,
    },
    usage: opinions.map((o) => ({ model: o.model, step: "consensus", cost_usd: null })),
    total_latency_ms: Date.now() - started,
    mesh_features: Array.from(meshFeatures),
  };
}

/**
 * Re-assess a message using the user's answers to context questions.
 * These answers are decisive: e.g. "someone is asking me to read out the code"
 * flips a genuine-looking OTP into a scam, while "I started this login myself"
 * clears it. Live uses a model; offline/₹0 falls back to deterministic scoring.
 */
export async function reassess(
  text: string,
  answers: QuestionAnswer[],
): Promise<{ verdict: Verdict; applied: string[] }> {
  const live = isLive() && process.env.MESH_FORCE_MOCK !== "1";
  if (!live) return mockReassess(text, answers);

  try {
    const plan = await resolvePlan();
    const signal = await extractSignal(text, plan);
    const qaLines = answers
      .map((a) => `- ${a.question ?? a.id} → ${a.answer}`)
      .join("\n");

    const res = await chat({
      model: plan.premiumAggregator,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "verdict", schema: VERDICT_SCHEMA } },
      messages: [
        {
          role: "system",
          content:
            "You are a fraud analyst re-assessing a message using the user's answers to context questions. " +
            "These answers are DECISIVE: if anyone is asking the user to share/read out/enter a code or secret, or a remote-access app is running, treat it as a scam even if the message looked benign. " +
            "If the user started the action themselves and no one is pressuring them, a delivered OTP is safe. " +
            "Return schema JSON in the user's language (" + signal.language + "). " +
            INJECTION_GUARD,
        },
        {
          role: "user",
          content: `User's answers to context questions:\n${qaLines}\n\nSignal:\n${JSON.stringify(signal)}\n\nMessage:\n${fenceUntrusted(text)}`,
        },
      ],
    });
    const parsed = parseJson<Verdict>(res.content);
    const safe = VerdictSchema.safeParse(parsed);
    if (safe.success) {
      return { verdict: { ...safe.data, confidence: normConfidence(safe.data.confidence) }, applied: qaLines.split("\n").filter(Boolean) };
    }
    return mockReassess(text, answers);
  } catch (err) {
    if (err instanceof MeshError && err.status === 402) return mockReassess(text, answers);
    throw err;
  }
}

const MAX_CONVERSE_ROUNDS = 3;

/**
 * Multi-round context conversation. Each round the model either asks a batch of
 * new yes/no questions or, once confident (or after MAX rounds), decides with a
 * final verdict. Offline/₹0 uses a deterministic multi-round heuristic.
 */
export async function converse(
  text: string,
  history: ConversationTurn[],
  round: number,
): Promise<ConverseResponse> {
  const live = isLive() && process.env.MESH_FORCE_MOCK !== "1";
  if (!live) return mockConverse(text, history, round);

  try {
    const plan = await resolvePlan();
    const signal = await extractSignal(text, plan);
    const mustDecide = round >= MAX_CONVERSE_ROUNDS || history.length >= 6;
    const qa = history.length
      ? history.map((h) => `- ${h.question} → ${h.answer}`).join("\n")
      : "(none yet)";

    const res = await chat({
      model: plan.cheapAggregator,
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: { name: "converse", schema: CONVERSE_SCHEMA } },
      messages: [
        {
          role: "system",
          content:
            "You are calmly interviewing a user to decide whether a message is a scam. " +
            "Each round you may ASK a batch of 2-4 NEW yes/no context questions (about their situation — who contacted them, did they initiate it, is anyone pressuring them to share a code, is a remote-access app running, etc.), or DECIDE with a final verdict. " +
            "Do NOT repeat questions already answered. Prefer to DECIDE as soon as the picture is clear. " +
            `You have completed ${round} round(s).` +
            (mustDecide ? " You MUST decide now — return action 'decide' with a verdict." : "") +
            " For each question set risky_answer (answer implying higher risk) and weight 10-45. Write in the user's language (" +
            signal.language +
            "). Return schema JSON. " +
            INJECTION_GUARD,
        },
        {
          role: "user",
          content: `Signal:\n${JSON.stringify(signal)}\n\nAnswers so far:\n${qa}\n\nMessage:\n${fenceUntrusted(text)}`,
        },
      ],
    });

    const parsed = parseJson<{
      action?: string;
      note?: string;
      questions?: FollowUpQuestion[];
      verdict?: Verdict;
    }>(res.content);

    if (!mustDecide && parsed?.action === "ask" && Array.isArray(parsed.questions) && parsed.questions.length) {
      const answeredIds = new Set(history.map((h) => h.id));
      const questions = parsed.questions
        .filter((q) => q && q.question && (q.risky_answer === "yes" || q.risky_answer === "no"))
        .map((q, i) => ({
          id: q.id || `r${round}q${i + 1}`,
          question: String(q.question),
          hint: q.hint ? String(q.hint) : undefined,
          risky_answer: q.risky_answer,
          weight: Math.max(5, Math.min(45, Number(q.weight) || 20)),
        }))
        .filter((q) => !answeredIds.has(q.id))
        .slice(0, 4);
      if (questions.length) return { action: "ask", questions, round: round + 1, note: parsed.note };
    }

    if (parsed?.verdict) {
      const safe = VerdictSchema.safeParse(parsed.verdict);
      if (safe.success) {
        return {
          action: "decide",
          verdict: { ...safe.data, confidence: normConfidence(safe.data.confidence) },
          applied: history.map((h) => `${h.question} → ${h.answer}`),
          round,
        };
      }
    }

    // Fallback: synthesise a decision from the answers.
    const fb = await reassess(text, history);
    return { action: "decide", verdict: fb.verdict, applied: fb.applied, round };
  } catch (err) {
    if (err instanceof MeshError && err.status === 402) return mockConverse(text, history, round);
    throw err;
  }
}
