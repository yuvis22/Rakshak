import type { RetrievalInfo, ScamMatch } from "@/lib/types";
import { SCAM_CORPUS, type ScamPattern } from "./scams";
import { embed, isLive } from "@/lib/mesh/client";

const EMBED_MODEL = "openai/text-embedding-3-small";
const TOP_K = 3;
const MIN_SIMILARITY = 12; // below this we don't surface a match

export interface Retrieval {
  matches: ScamMatch[];
  info: RetrievalInfo;
  /** Compact context block injected into the verdict prompt. */
  context: string;
}

/** Text used to represent a pattern for both embedding and lexical matching. */
function patternText(p: ScamPattern): string {
  return [p.name, p.description, p.tactics.join(". "), p.keywords.join(", "), p.aliases.join(", ")].join(". ");
}

/* ---------------- lexical retrieval (always available, offline) ---------------- */

const STOP = new Set([
  "the", "a", "an", "to", "of", "and", "or", "is", "are", "your", "you", "will", "for", "on",
  "in", "at", "this", "that", "it", "be", "with", "has", "have", "not", "no", "do", "if",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function lexicalScores(message: string): number[] {
  const msg = message.toLowerCase();
  const tokens = new Set(tokenize(message));
  return SCAM_CORPUS.map((p) => {
    let score = 0;
    // Strong signal: exact keyword/alias phrase present in the message.
    for (const kw of p.keywords) if (msg.includes(kw)) score += kw.includes(" ") ? 3 : 2;
    for (const al of p.aliases) if (msg.includes(al.toLowerCase())) score += 4;
    // Weaker signal: token overlap with the pattern's descriptive text.
    const ptoks = new Set(tokenize(patternText(p)));
    let overlap = 0;
    for (const t of tokens) if (ptoks.has(t)) overlap += 1;
    score += overlap;
    return score;
  });
}

/* ---------------- semantic retrieval (Mesh embeddings, when live) --------------- */

let corpusVecCache: number[][] | null = null;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function semanticScores(message: string): Promise<number[]> {
  if (!corpusVecCache) {
    corpusVecCache = await embed(SCAM_CORPUS.map(patternText), EMBED_MODEL);
  }
  const [q] = await embed([message], EMBED_MODEL);
  return corpusVecCache.map((v) => cosine(q, v));
}

/* ---------------- public API ---------------- */

function toMatches(scores: number[], normalize: (s: number) => number): ScamMatch[] {
  return SCAM_CORPUS.map((p, i) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    status: p.status,
    similarity: Math.round(normalize(scores[i])),
    advice: p.advice,
  }))
    .filter((m) => m.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K);
}

function buildContext(matches: ScamMatch[]): string {
  if (!matches.length) return "No known scam pattern strongly matched this message.";
  return matches
    .map((m) => {
      const p = SCAM_CORPUS.find((x) => x.id === m.id)!;
      return `- ${p.name} (${m.similarity}% match, ${p.status}): ${p.description} Typical ask: ${p.typical_ask} Advice: ${p.advice}`;
    })
    .join("\n");
}

export async function retrieve(message: string): Promise<Retrieval> {
  // Try semantic retrieval when a live key is configured; fall back to lexical.
  if (isLive()) {
    try {
      const scores = await semanticScores(message);
      // cosine similarity is ~0..1; map to a friendlier 0..100 scale.
      const matches = toMatches(scores, (s) => Math.max(0, Math.min(100, s * 100)));
      return {
        matches,
        info: {
          method: "embeddings",
          model: EMBED_MODEL,
          corpus_size: SCAM_CORPUS.length,
          top_similarity: matches[0]?.similarity ?? 0,
        },
        context: buildContext(matches),
      };
    } catch {
      corpusVecCache = null; // reset so a later successful call can rebuild
      // fall through to lexical
    }
  }

  const raw = lexicalScores(message);
  const max = Math.max(1, ...raw);
  const matches = toMatches(raw, (s) => (s / max) * 100);
  return {
    matches,
    info: {
      method: "lexical",
      corpus_size: SCAM_CORPUS.length,
      top_similarity: matches[0]?.similarity ?? 0,
    },
    context: buildContext(matches),
  };
}
