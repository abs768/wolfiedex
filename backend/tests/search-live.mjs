/**
 * Live search test — Groq + local MiniLM + MongoDB Atlas $vectorSearch
 * All times displayed in Eastern Time (ET).
 *
 * Usage: node tests/search-live.mjs "your query here"
 */

import { MongoClient } from "mongodb";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const GROQ_KEY = "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";

const groq = new Groq({ apiKey: GROQ_KEY });

// ── UTC → Eastern Time ───────────────────────────────────────────────────────

function toET(isoString) {
  return new Date(isoString).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}

function toETShort(isoString) {
  return new Date(isoString).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " ET";
}

async function generateText(prompt) {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? "";
}

const QUERY = process.argv[2] || "what are some events this friday";
const CURRENT_DATE = new Date().toLocaleString("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

async function main() {
  console.log("🧠 Loading embedding model...");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  async function embed(text) {
    const result = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(result.data);
  }

  console.log(`\n🔍 Query: "${QUERY}"`);
  console.log(`📅 Current date: ${CURRENT_DATE} (Eastern Time)\n`);

  // ── Step 1: HyDE ──
  console.log("━━━ Step 1: HyDE ━━━\n");
  const hydePrompt = `You are a university event search assistant. A student is searching for events.

Given their query, write a HYPOTHETICAL event summary (80-120 words) that would be the PERFECT match.

Include: event type, format, topics, target audience, benefits, time of day, emotional tone.
The current date is ${CURRENT_DATE} (Eastern Time).

Student query: "${QUERY}"

Hypothetical event summary:`;

  const hypothetical = await generateText(hydePrompt);
  console.log(`   "${hypothetical}"\n`);

  // ── Step 2: Embed ──
  console.log("━━━ Step 2: Embed ━━━\n");
  const queryVector = await embed(hypothetical);
  console.log(`   Vector: [${queryVector.slice(0, 4).map(v => v.toFixed(4)).join(", ")}, ...] (${queryVector.length}-d)\n`);

  // ── Step 3: $vectorSearch ──
  console.log("━━━ Step 3: MongoDB Atlas $vectorSearch ━━━\n");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("campus_events");

  const results = await db.collection("events").aggregate([
    {
      $vectorSearch: {
        index: "event_vector_index",
        path: "embedding",
        queryVector,
        numCandidates: 20,
        limit: 6,
      },
    },
    {
      $project: {
        _id: 0,
        eventId: 1,
        title: 1,
        full_description: 1,
        date: 1,
        end_date: 1,
        location: 1,
        url: 1,
        image_url: 1,
        categories: 1,
        benefits: 1,
        organization: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();

  results.forEach((e, i) => {
    const tag = i < 2 ? "🟢 PRIMARY" : "🔵 SIMILAR";
    console.log(`   ${i + 1}. ${tag}  score=${e.score.toFixed(4)}  "${e.title}"`);
    console.log(`      📅 ${toETShort(e.date)} → ${toETShort(e.end_date)}`);
    console.log(`      📍 ${e.location} | Org: ${e.organization}`);
    if (e.benefits?.length) console.log(`      🎁 ${e.benefits.join(", ")}`);
    console.log();
  });

  // ── Step 4: Synthesis ──
  console.log("━━━ Step 4: AI Synthesis ━━━\n");
  const top2 = results.slice(0, 2);
  const synthesisPrompt = `You are a friendly, enthusiastic university events assistant at Stony Brook University. A student asked a question and you found matching campus events.

Rules:
- Answer conversationally in 2-4 sentences
- ALL times must be in Eastern Time (ET)
- Mention specific event names, dates, times (ET), and locations
- Highlight details the student would care about
- If events don't match well, be honest but still mention what's available
- Do NOT make up events not listed below
- Today's date is ${CURRENT_DATE} (Eastern Time)

Student question: "${QUERY}"

Matching events:
${top2.map((e, i) => `[Event ${i + 1}]
Title: ${e.title}
Start: ${toET(e.date)}
End: ${toET(e.end_date)}
Location: ${e.location}
Description: ${e.full_description?.substring(0, 300)}
Organization: ${e.organization}
Benefits: ${(e.benefits || []).join(", ") || "None listed"}`).join("\n\n")}

Your response:`;

  const aiResponse = await generateText(synthesisPrompt);
  console.log(`   💬 "${aiResponse}"\n`);

  // ── Step 5: Final JSON ──
  console.log("━━━ Step 5: API Response ━━━\n");
  const response = {
    ai_response: aiResponse,
    primary_events: results.slice(0, 2).map(({ score, ...e }) => ({
      ...e,
      date_et: toETShort(e.date),
      end_date_et: toETShort(e.end_date),
    })),
    similar_events: results.slice(2, 6).map(({ score, full_description, ...e }) => ({
      ...e,
      date_et: toETShort(e.date),
      end_date_et: toETShort(e.end_date),
    })),
  };

  console.log(JSON.stringify(response, null, 2));
  await client.close();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
