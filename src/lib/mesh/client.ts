/**
 * Mesh API client.
 *
 * This is the single, visible integration point required by the hackathon:
 * every AI call in Rakshak goes through https://api.meshapi.ai/v1 using a
 * Mesh `rsk_` key. Nothing calls a model provider directly.
 *
 * Mesh is OpenAI-compatible, so the request/response shapes match the OpenAI
 * chat-completions contract. We use fetch directly (instead of the OpenAI SDK)
 * so we can also reach Mesh-native endpoints like /v1/chat/compare and read
 * auto-routing metadata headers.
 */

const BASE_URL = process.env.MESH_BASE_URL || "https://api.meshapi.ai/v1";
const API_KEY = process.env.MESH_API_KEY || "";

/** True when a usable key is configured. In mock mode the pipeline never hits the network. */
export function isLive(): boolean {
  return API_KEY.startsWith("rsk_") && API_KEY !== "rsk_your_key_here";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  json_schema?: { name: string; schema: Record<string, unknown> };
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
}

export interface ChatResult {
  content: string;
  model: string; // the model that actually served the request
  auto_routed: boolean;
  fallback: boolean;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  latency_ms: number;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Single chat completion through Mesh. */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0,
      ...(opts.max_tokens ? { max_tokens: opts.max_tokens } : {}),
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }

  const data = await res.json();
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    model: data?.x_resolved_model_id ?? data?.model ?? opts.model,
    auto_routed: Boolean(data?.x_auto_routed),
    fallback: Boolean(data?.x_auto_routed_fallback),
    usage: data?.usage,
    latency_ms: Date.now() - started,
  };
}

/**
 * Try a list of models in order until one succeeds. Powers the "live fallback"
 * demo: if the primary model errors (e.g. forced-bad model in the UI toggle),
 * Mesh routing still keeps the check alive on a backup.
 */
export async function chatWithFallback(
  models: string[],
  opts: Omit<ChatOptions, "model">,
): Promise<ChatResult & { fallback_from?: string }> {
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      const result = await chat({ ...opts, model: models[i] });
      return i === 0 ? result : { ...result, fallback: true, fallback_from: models[0] };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("All fallback models failed");
}

export interface CompareModelResult {
  model: string;
  content: string;
  latency_ms?: number;
  error?: string | null;
  usage?: Record<string, unknown>;
}

/**
 * Mesh-native multi-model fan-out: one prompt, many models, in parallel.
 * We use skip_comparison so we get each model's raw opinion back and do our
 * own synthesis (the consensus panel + aggregator).
 */
export async function compare(params: {
  models: string[];
  messages: ChatMessage[];
  response_format?: ResponseFormat;
  temperature?: number;
}): Promise<{ results: CompareModelResult[]; partial: boolean; total_latency_ms: number }> {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/compare`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      models: params.models,
      messages: params.messages,
      temperature: params.temperature ?? 0,
      skip_comparison: true,
      ...(params.response_format ? { model_overrides: {} } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }

  const data = await res.json();
  const results: CompareModelResult[] = (data?.results ?? []).map(
    (r: Record<string, unknown>) => ({
      model: (r.model as string) ?? "unknown",
      content:
        ((r.message as Record<string, unknown>)?.content as string) ??
        (r.content as string) ??
        "",
      latency_ms: r.latency_ms as number | undefined,
      error: (r.error as string | null) ?? null,
      usage: r.usage as Record<string, unknown> | undefined,
    }),
  );
  return {
    results,
    partial: Boolean(data?.partial),
    total_latency_ms: Date.now() - started,
  };
}

export interface MeshModel {
  id: string;
  name: string;
  is_free: boolean;
  supports_structured_output?: boolean;
  supports_completions_api?: boolean;
  input_modalities?: string[];
  pricing?: {
    prompt_usd_per_1k?: string | null;
    completion_usd_per_1k?: string | null;
  };
}

/** Create embeddings through Mesh (used for RAG retrieval over the scam knowledge base). */
export async function embed(input: string[], model: string): Promise<number[][]> {
  const res = await fetch(`${BASE_URL}/embeddings`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }
  const data = await res.json();
  const rows = (data?.data ?? []) as Array<{ embedding: number[] }>;
  return rows.map((r) => r.embedding);
}

/** List models from the gateway. freeOnly hits the /models/free shortcut endpoint. */
export async function listModels(freeOnly = false): Promise<MeshModel[]> {
  const res = await fetch(`${BASE_URL}/models${freeOnly ? "/free" : ""}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (data?.data ?? []);
  return arr as MeshModel[];
}

export interface WebSearchResult {
  query: string;
  answer: string | null;
  results: { title: string; url: string; content?: string; score?: number | null }[];
  provider: string;
}

/** Mesh Web Search — used to gather live intel on senders, links, and claims. */
export async function webSearch(params: {
  query: string;
  max_results?: number;
  include_answer?: boolean;
  model?: string;
}): Promise<WebSearchResult> {
  const res = await fetch(`${BASE_URL.replace(/\/v1$/, "")}/v1/web/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      query: params.query,
      max_results: params.max_results ?? 4,
      include_answer: params.include_answer ?? true,
      ...(params.model ? { model: params.model } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }
  const data = await res.json();
  return {
    query: data?.query ?? params.query,
    answer: data?.answer ?? null,
    results: data?.results ?? [],
    provider: data?.provider ?? "native",
  };
}

/** Mesh Speech-to-Text — transcribe an audio data-URL to text (multipart upload). */
export async function transcribe(dataUrl: string, model: string): Promise<string> {
  const comma = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, comma);
  const b64 = dataUrl.slice(comma + 1);
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "audio/webm";
  const ext = mime.split("/")[1]?.split(";")[0] ?? "webm";
  const bytes = Buffer.from(b64, "base64");

  const form = new FormData();
  form.append("model", model);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), `audio.${ext}`);

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` }, // let fetch set the multipart boundary
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }
  const data = await res.json();
  return (data?.text ?? "").trim();
}

/** Mesh Text-to-Speech — returns raw audio bytes (mp3). */
export async function speak(params: {
  input: string;
  model?: string;
  voice?: string;
  language_code?: string;
}): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: params.model ?? "eleven_flash_v2_5",
      input: params.input,
      voice: params.voice ?? "JBFqnCBsd6RMkjVDRZzb",
      stream: false,
      response_format: "mp3_44100_128",
      ...(params.language_code ? { language_code: params.language_code } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MeshError(res.status, text || res.statusText);
  }
  return {
    audio: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "audio/mpeg",
  };
}

export class MeshError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`Mesh API ${status}: ${message}`);
    this.status = status;
    this.name = "MeshError";
  }
}
