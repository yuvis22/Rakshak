import fs from "node:fs";
import path from "node:path";
import type { ScamPattern } from "./scams";

/**
 * Persistent learned-scam store — the self-learning half of the RAG system.
 *
 * When a user confirms a scam, a distilled pattern is appended here and merged
 * into the retrieval corpus, so every future check benefits. Backed by a JSON
 * file locally; if the filesystem is read-only (serverless), it degrades to an
 * in-memory store for the process lifetime.
 */

export interface LearnedPattern extends ScamPattern {
  learned: true;
  reported_at: string;
}

const FILE = path.join(process.cwd(), "data", "learned-scams.json");
const MAX = 300;

let cache: LearnedPattern[] | null = null;

function load(): LearnedPattern[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as LearnedPattern[];
  } catch {
    cache = [];
  }
  return cache;
}

export function allLearned(): LearnedPattern[] {
  return load();
}

export function addLearned(p: LearnedPattern): void {
  const list = load().filter((x) => x.id !== p.id);
  list.unshift(p);
  cache = list.slice(0, MAX);
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch {
    /* read-only FS — keep in memory only */
  }
}

/** Monotonic version used to invalidate the embedding cache when the corpus grows. */
export function learnedVersion(): number {
  return load().length;
}
