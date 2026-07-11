# Rakshak

**AI-powered scam shield for India — built on the Mesh API**

[![Mesh API Hackathon 2026](https://img.shields.io/badge/Mesh_Hackathon-2026-6366f1)](https://hack.meshapi.ai/)
[![Track: Multi-model](https://img.shields.io/badge/Track-Multi--model-22c55e)](https://hack.meshapi.ai/#tracks)
[![Track: Bharat](https://img.shields.io/badge/Track-Bharat-22c55e)](https://hack.meshapi.ai/#tracks)
[![Track: Knowledge & RAG](https://img.shields.io/badge/Track-Knowledge_&_RAG-22c55e)](https://hack.meshapi.ai/#tracks)

> Paste a suspicious SMS, WhatsApp forward, email, screenshot, or voice note.  
> Rakshak analyses it across multiple AI models through a single Mesh gateway and returns a clear verdict — **safe**, **suspicious**, or **scam** — with reasons, red flags, and what to do next.

**Submit:** [hack.meshapi.ai/submit](https://hack.meshapi.ai/submit) · **Idea Bank:** [hack.meshapi.ai/ideas](https://hack.meshapi.ai/ideas)

---

## The problem

India loses thousands of crores every year to digital fraud — KYC-blocking SMS, fake lottery wins, electricity disconnection threats, UPI refund tricks, and "digital arrest" calls. These messages arrive in **Hindi, Hinglish, and English**, often targeting users with low digital literacy. Most people have no reliable way to verify a message before acting on it.

Rakshak gives every citizen a **single, trustworthy dashboard** to check any suspicious communication — with full transparency into how the AI reached its conclusion.

---

## The solution

Rakshak is a full-stack Next.js application that routes **every AI call exclusively through the [Mesh API](https://meshapi.ai)**. No direct OpenAI, Anthropic, or Google keys. One `rsk_` key powers the entire stack.

| Input | What happens |
|-------|----------------|
| **Text** | Paste SMS / WhatsApp / email copy |
| **Screenshot** | Mesh vision OCR reads the message |
| **Voice note** | Sarvam STT (via Mesh) transcribes Indian languages |
| **Follow-up Q&A** | Multi-round conversation refines ambiguous verdicts |

The pipeline is **cost-aware** (cheap models first, premium only on escalation), **resilient** (live fallback demo with zero downtime), and **grounded** (RAG over a curated Indian scam corpus + user-reported patterns).

---

## Architecture

```
User input (text / screenshot / voice note)
        │
        ▼
┌───────────────────────────────────────────────────┐
│  Mesh orchestration pipeline (pipeline.ts)        │
│                                                   │
│  1. Transcribe media (vision / STT) if needed     │
│  2. Extract structured signal (dv02)              │
│  3. RAG: match known scam patterns (dv05)         │
│  4. Auto-route triage model                       │
│  5. Cheap consensus (dv03 / dv01)                 │
│  6. Escalate to premium if high-stakes / unsure   │
│  7. Web search intel (parallel)                   │
│  8. Synthesize final verdict                      │
│  9. Generate context questions for refinement     │
└───────────────────────────────────────────────────┘
        │
        ▼
Verdict + model opinions + routing metadata + Mesh features used
```

```mermaid
flowchart TD
    UI[page.tsx] -->|POST SSE| Stream[/api/analyze/stream]
    Stream --> Pipeline[pipeline.ts]

    Pipeline --> Media{Image / Audio?}
    Media -->|Yes| Transcribe[Vision / Sarvam STT]
    Media -->|No| Extract
    Transcribe --> Extract[Signal extraction]

    Extract --> RAG[Scam pattern retrieval]
    Extract --> Triage[Mesh auto-router]
    Extract --> Intel[Web search intel]

    RAG --> Consensus[Cheap model consensus]
    Consensus --> Escalate{High stakes / disagree?}
    Escalate -->|Yes| Premium[Premium model consensus]
    Escalate -->|No| Synthesize
    Premium --> Synthesize[Final verdict synthesis]

    Synthesize --> Result[AnalysisResult]
    Result --> UI

    UI --> Converse[/api/converse]
    Converse --> Pipeline
```

**Design principles**

- **Mesh-only** — single integration surface (`src/lib/mesh/client.ts`)
- **Cheap-first routing** — routine checks stay on low-cost models; premium tier only on escalation
- **Graceful degradation** — offline mock engine when balance is ₹0; live fallback when a model fails
- **Prompt-injection hardening** — untrusted message text is fenced and guarded (`src/lib/security.ts`)
- **Self-learning** — confirmed scams via `/api/report` join the RAG corpus immediately

---

## Mesh capabilities exercised

Every run surfaces which Mesh features were used (visible in the UI):

| Mesh capability | Endpoint / feature | Used for |
|-----------------|-------------------|----------|
| Chat completions | `/v1/chat/completions` | Signal extraction, synthesis, Q&A |
| Structured output | `response_format: json_schema` | `ScamSignal`, `Verdict`, follow-up questions |
| Multi-model compare | `/v1/chat/compare` (streaming) | Parallel model opinions |
| Auto-routing | `/v1/router/select` | Triage + escalation model pick |
| Embeddings | `/v1/embeddings` | Semantic scam-pattern retrieval |
| Web search | `/v1/web/search` | Live intel on links and senders |
| Vision | Multimodal chat | Screenshot OCR |
| Speech-to-text | `/v1/audio/transcriptions` | Indian-language voice notes (Sarvam) |
| Text-to-speech | `/v1/audio/speech` | Hear the verdict aloud |
| Fallback routing | `chatWithFallback` + auto-router | Zero-downtime model failover |

---

## Idea Bank mapping

Built for the [Mesh Idea Bank](https://hack.meshapi.ai/ideas) — one polished product that **remixes multiple ideas** instead of seven throwaway demos. Each row below maps to **real, inspectable code** in this repo.

### Core implementation (primary pitch)

| ID | Idea | Implementation | Code |
|----|------|----------------|------|
| **ba02** | Fraud ya nahi | Core product — paste message → `safe` / `suspicious` / `scam` with reasons | `pipeline.ts` → `analyze()` |
| **dv02** | Structured extractor | Messy SMS/email → clean `ScamSignal` JSON via Mesh structured output | `extractSignal()` |
| **dv04** | Fallback demo | UI toggle forces a bad model; Mesh reroutes instantly — visible in orchestration panel | `chatWithFallback()`, `forceFallback` toggle |
| **dv05** | RAG over my notes | Curated Indian scam corpus + user-reported patterns, embeddings or lexical fallback | `knowledge/scams.ts`, `retrieval.ts`, `learn.ts` |
| **cr05** | Model playground | Same prompt judged by 4+ models side-by-side, streamed live | `ModelPanel`, `compareStream()` |
| **ba01** | Bolke likho | Voice note → clean text via Sarvam STT through Mesh | `transcribe()` in `client.ts` |

### Inspired by (same Mesh capability, adapted domain)

| ID | Idea | How Rakshak adapts it |
|----|------|----------------------|
| **dv03** | Cheapest that works | Automatic cheap-first routing with escalation — orchestration panel shows tier (`cheap` / `mixed`) |
| **dv01** | Classify my tickets | Cheap classification pattern applied to fraud risk instead of support tickets |

### Accessibility extensions

| ID | Idea | How Rakshak adapts it |
|----|------|----------------------|
| **ba03** | Form samjho | Screenshot upload → vision OCR (message text, not govt-form explanation) |
| **ba06** | Screen explainer | Vision input + TTS verdict playback for low-literacy users |

---

## Key features

### For end users
- Instant scam check in Hindi, Hinglish, or English
- Screenshot and voice-note support (no typing required)
- Plain-language verdict with red flags and safety actions (report to **1930**, cybercrime.gov.in)
- Multi-round context conversation — "Did someone ask you to read out the OTP?" flips benign-looking messages
- Listen to verdict (TTS), share result card, report confirmed scams

### For judges / technical reviewers
- **Live SSE streaming** — watch each model's opinion arrive in real time
- **Orchestration panel** — triage model, escalation reason, router selection, latency, tier
- **Mesh features badge** — every run lists exactly which Mesh APIs were exercised
- **Offline mock engine** — full demo without API balance; switches to live on key detection
- **Prompt-injection defence** — scam messages can't hijack the AI's instructions

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| AI gateway | Mesh API (OpenAI-compatible) |
| Validation | Zod 4 |
| Language | TypeScript |
| Streaming | Server-Sent Events (SSE) |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                    # Main dashboard
│   └── api/
│       ├── analyze/stream/route.ts # Primary SSE analysis endpoint
│       ├── analyze/route.ts        # Non-streaming analysis
│       ├── converse/route.ts       # Multi-round context Q&A
│       ├── reassess/route.ts       # Re-score after user answers
│       ├── speak/route.ts          # TTS for verdict
│       ├── report/route.ts         # User scam reports → RAG corpus
│       ├── card/route.tsx          # Shareable verdict card image
│       └── models/route.ts         # Mesh model listing
├── components/
│   ├── VerdictCard.tsx             # Final verdict display
│   ├── ModelPanel.tsx              # Multi-model consensus (cr05)
│   ├── OrchestrationPanel.tsx      # Routing & escalation metadata
│   ├── StreamProgress.tsx          # Live pipeline progress
│   ├── Conversation.tsx            # Context Q&A flow
│   ├── MatchPanel.tsx              # RAG scam-pattern matches
│   ├── IntelPanel.tsx              # Web search intel
│   └── MeshFeatures.tsx            # Mesh capability badges
└── lib/
    ├── mesh/
    │   ├── client.ts               # Mesh API client (single integration point)
    │   ├── pipeline.ts             # Full orchestration pipeline
    │   ├── models.ts               # Cheap / premium model tiers
    │   ├── plan.ts                 # Model plan resolver
    │   └── mock.ts                 # Offline heuristic engine
    ├── knowledge/
    │   ├── scams.ts                # Curated Indian scam corpus
    │   ├── retrieval.ts            # Embeddings + lexical RAG
    │   ├── learn.ts                # Distil user reports into patterns
    │   └── store.ts                # Persisted learned patterns
    ├── types.ts                    # Shared schemas (ScamSignal, Verdict, …)
    ├── security.ts                 # Prompt-injection hardening
    └── questions.ts                # Heuristic follow-up question bank
```

---

## Getting started

### Prerequisites

- Node.js 20+
- Mesh API key (`rsk_…`) from [app.meshapi.ai](https://app.meshapi.ai)

### Install & run

```bash
git clone <your-repo-url>
cd Rakshak
npm install          # or: yarn install

cp .env.example .env.local
# Set MESH_API_KEY=rsk_your_key_here in .env.local

npm run dev          # or: yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MESH_API_KEY` | Yes (for live) | Mesh API key (`rsk_…`) |
| `MESH_BASE_URL` | No | Gateway URL (default: `https://api.meshapi.ai/v1`) |
| `MESH_FORCE_MOCK` | No | Set `1` to force offline mock engine |

Without a valid key, Rakshak uses a built-in offline engine for text analysis. Screenshot and voice-note analysis require a live Mesh balance.

User-reported scams are saved to `data/learned-scams.json` locally (gitignored). On read-only serverless filesystems, learned patterns persist for the process lifetime only.

---

## Known limitations (honest scope)

What Rakshak **is**: a risk-assessment dashboard that remixes multiple Mesh capabilities into one citizen-facing scam check.

What it **is not**:

| Limitation | Detail |
|------------|--------|
| Not a guarantee | Verdicts are AI risk assessments — always verify with official bank helplines |
| No batch inbox | One message per check; not a full email-inbox sorter (`wk02`-style pile sorting) |
| No cost dashboard | Cheap-first routing is automatic (`dv03`-inspired); per-model cost comparison UI is not built |
| Media needs balance | Screenshot OCR and voice-note STT require a live Mesh balance |
| Learned patterns | Persist to disk locally; may not survive serverless cold starts on all hosts |
| Web only | Responsive dashboard — no native Android/iOS app |

---

## Hackathon submission checklist

Use this when filling [hack.meshapi.ai/submit](https://hack.meshapi.ai/submit):

| Field | What to put |
|-------|-------------|
| **Project title** | Rakshak |
| **Track** | Multi-model *(primary)* — also fits Bharat, Knowledge & RAG |
| **One-paragraph pitch** | See [One-paragraph pitch](#one-paragraph-pitch) below |
| **GitHub repo URL** | Your public repo (or grant read access to contact@meshapi.ai if private) |
| **Demo video URL** | 2–3 min screen recording + webcam; follow [Demo walkthrough](#demo-walkthrough-23-min-video) |
| **Live demo URL** | Vercel / deployed instance (recommended) |
| **Where is Mesh used?** | `src/lib/mesh/client.ts` (all API calls) → `src/lib/mesh/pipeline.ts` (orchestration). Endpoints: chat/completions, chat/compare, router/select, embeddings, web/search, vision, audio/transcriptions, audio/speech |

**Before you submit:** run `yarn build` locally, deploy live demo, record video showing fallback toggle + orchestration panel + Mesh features badge.

---

## Demo walkthrough (2–3 min video)

Recommended flow for judges and reviewers:

| Step | Action | What to highlight |
|------|--------|-------------------|
| 1 | Paste **KYC scam example** | Live model opinions streaming in; verdict = scam |
| 2 | Paste **safe coffee example** | Cheap-only routing, no escalation |
| 3 | Toggle **"Demo live fallback"**, re-run | Mesh reroutes from failed model — `dv04` |
| 4 | Upload a **screenshot** of a scam SMS | Vision OCR → full pipeline |
| 5 | Open **Orchestration panel** | Escalation reason, tier, router pick, latency |
| 6 | Start **context conversation** | Answer "yes, someone asked for my OTP" → verdict flips |
| 7 | Click **Listen** | TTS verdict in user's language |
| 8 | Point to **Mesh features badge** | Lists every Mesh API used in that run |

---

## One-paragraph pitch

*Copy-paste ready for the [submission form](https://hack.meshapi.ai/submit).*

> Indian users are bombarded with scam SMS, WhatsApp forwards, and phishing in Hindi, Hinglish, and English. Rakshak is a single dashboard that checks any suspicious message through the Mesh API: it extracts structured signals, matches known scam patterns via RAG, gathers live web intel, runs cheap models first and escalates to premium only when needed, and synthesizes a final verdict with red flags and safety actions — with zero direct provider keys, visible orchestration, live fallback demo, and a self-learning loop where user-reported scams immediately join the knowledge base.

**Tracks:** Multi-model · Bharat · Knowledge & RAG

**Mesh integration entry point:** `src/lib/mesh/client.ts` → `src/lib/mesh/pipeline.ts`

---

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

---

## Disclaimer

Rakshak provides a **risk assessment**, not a legal or financial guarantee. When in doubt, verify with your bank's official helpline and report fraud to **1930** or [cybercrime.gov.in](https://cybercrime.gov.in).

---

## Links

- [Mesh API Hackathon 2026](https://hack.meshapi.ai/)
- [Submit your project](https://hack.meshapi.ai/submit)
- [Idea Bank](https://hack.meshapi.ai/ideas)
- [Mesh API documentation](https://meshapi.ai)
- [Get a Mesh API key](https://app.meshapi.ai)
