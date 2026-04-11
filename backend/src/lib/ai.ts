// ═══════════════════════════════════════════════════════════════════════════════
// AI Utilities — Groq (Text Generation) + Local MiniLM (Embeddings)
// ═══════════════════════════════════════════════════════════════════════════════
//
// WHY THIS SPLIT:
//   • Groq provides blazing-fast LLM inference (~200 tok/s) via Llama 3.3 70B.
//     Used for: search summaries, HyDE hypotheticals, conversational synthesis.
//
//   • Embeddings run locally via @xenova/transformers (all-MiniLM-L6-v2, 384-d).
//     This avoids external API rate limits entirely and keeps latency low.
//     The model (~30MB) is downloaded once and cached on disk.

import Groq from "groq-sdk";

// ── Environment ──────────────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY!;

if (!GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY environment variable is not set. " +
    "Get your key from https://console.groq.com"
  );
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

// ── Text Generation (Groq — Llama 3.3 70B Versatile) ────────────────────────

export async function generateText(prompt: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content ?? "";
}

// ── Embeddings (Local all-MiniLM-L6-v2 — 384 dimensions) ────────────────────
//
// Lazy-loaded singleton: the model is only downloaded/initialized on the first
// call. Subsequent calls reuse the cached pipeline.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;

async function getEmbedder() {
  if (!embedder) {
    // Dynamic import to avoid bundling issues with Next.js
    const { pipeline } = await import("@xenova/transformers" as any);
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const result = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(result.data) as number[];
}

/** The dimensionality of our embedding model — used for Atlas index config */
export const EMBEDDING_DIMENSIONS = 384;
