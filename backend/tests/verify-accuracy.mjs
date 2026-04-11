/**
 * Accuracy Verification Test
 *
 * 1. Runs 5 search queries through the full HyDE pipeline
 * 2. For each result, fetches the SAME event from the live Engage API
 * 3. Compares: title, time, location, description — field by field
 *
 * Usage: node tests/verify-accuracy.mjs
 */

import { MongoClient } from "mongodb";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const GROQ_KEY = "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";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";

const groq = new Groq({ apiKey: GROQ_KEY });

function toET(iso) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }) + " ET";
}

function stripHtml(html) {
  return (html || "")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…").replace(/&ndash;/g, "–").replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, "\n").trim();
}

async function generateText(prompt) {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300, temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? "";
}

// ── Fetch a specific event from live Engage API by searching for its name ────
async function fetchLiveEvent(eventName) {
  const params = new URLSearchParams({
    endsAfter: "2026-04-10T00:00:00Z",
    orderByField: "endsOn",
    orderByDirection: "ascending",
    status: "Approved",
    query: eventName.substring(0, 40), // Use first 40 chars as search
    take: "5",
  });
  const res = await fetch(`${ENGAGE_API}?${params}`);
  const data = await res.json();
  return data.value || [];
}

// ── Full search pipeline ─────────────────────────────────────────────────────
async function search(embedder, db, query) {
  const CURRENT_DATE = "Friday, April 10, 2026";

  // Step 1: HyDE
  const hydePrompt = `You are a university event search assistant.
Write a HYPOTHETICAL event summary (80-120 words) that perfectly matches this query.
Current date: ${CURRENT_DATE} (Eastern Time).
Query: "${query}"
Hypothetical event summary:`;
  const hypothetical = await generateText(hydePrompt);

  // Step 2: Embed
  const result = await embedder(hypothetical, { pooling: "mean", normalize: true });
  const queryVector = Array.from(result.data);

  // Step 3: $vectorSearch
  const results = await db.collection("events").aggregate([
    {
      $vectorSearch: {
        index: "event_vector_index", path: "embedding",
        queryVector, numCandidates: 20, limit: 6,
      },
    },
    {
      $project: {
        _id: 0, eventId: 1, title: 1, full_description: 1,
        date: 1, end_date: 1, location: 1, url: 1,
        categories: 1, benefits: 1, organization: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();

  // Step 4: Synthesis
  const top2 = results.slice(0, 2);
  const synthPrompt = `You are a friendly university events assistant at Stony Brook.
ALL times in Eastern Time (ET). Today is ${CURRENT_DATE}.
Answer in 2-3 sentences. Do NOT make up events.

Question: "${query}"

Events:
${top2.map((e, i) => `[${i + 1}] ${e.title} | ${toET(e.date)} → ${toET(e.end_date)} | ${e.location} | ${e.full_description?.substring(0, 200)}`).join("\n")}

Response:`;
  const aiResponse = await generateText(synthPrompt);

  return { results, aiResponse };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🧠 Loading embedding model...\n");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("campus_events");

  const QUERIES = [
    "any events with free food?",
    "wellness or meditation events today",
    "coding or tech events happening soon",
    "fun social events this weekend",
    "sports or fitness activities",
  ];

  let totalChecked = 0;
  let totalMatch = 0;
  let totalMismatch = 0;

  for (const query of QUERIES) {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log(`║  QUERY: "${query}"`);
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    const { results, aiResponse } = await search(embedder, db, query);

    console.log(`💬 AI Response:\n   "${aiResponse}"\n`);

    // Verify each of the top 6 results against live API
    for (let i = 0; i < Math.min(results.length, 6); i++) {
      const our = results[i];
      const tag = i < 2 ? "🟢 PRIMARY" : "🔵 SIMILAR";

      console.log(`── ${tag} #${i + 1}: "${our.title}" ──`);
      console.log(`   Our DB   → Time: ${toET(our.date)} → ${toET(our.end_date)}`);
      console.log(`   Our DB   → Location: ${our.location}`);
      console.log(`   Our DB   → Desc: ${(our.full_description || "").substring(0, 120)}...`);
      console.log(`   Our DB   → Score: ${our.score.toFixed(4)}`);

      // Fetch the same event from live Engage API
      const liveResults = await fetchLiveEvent(our.title);
      const live = liveResults.find(e => e.id.toString() === our.eventId)
        || liveResults.find(e => e.name === our.title);

      if (!live) {
        console.log(`   Live API → ⚠️  Could not find event in live API search`);
        console.log();
        continue;
      }

      const liveDesc = stripHtml(live.description);

      // Compare fields
      const checks = [
        {
          field: "Title",
          ours: our.title,
          live: live.name,
          match: our.title === live.name,
        },
        {
          field: "Start Time",
          ours: toET(our.date),
          live: toET(live.startsOn),
          match: toET(our.date) === toET(live.startsOn),
        },
        {
          field: "End Time",
          ours: toET(our.end_date),
          live: toET(live.endsOn),
          match: toET(our.end_date) === toET(live.endsOn),
        },
        {
          field: "Location",
          ours: our.location,
          live: live.location,
          match: our.location === live.location,
        },
        {
          field: "Description",
          ours: (our.full_description || "").substring(0, 80),
          live: liveDesc.substring(0, 80),
          match: (our.full_description || "").substring(0, 80) === liveDesc.substring(0, 80),
        },
      ];

      console.log(`   Live API → Verifying against live data...`);

      for (const c of checks) {
        totalChecked++;
        if (c.match) {
          totalMatch++;
          console.log(`      ✅ ${c.field}: MATCH`);
        } else {
          totalMismatch++;
          console.log(`      ❌ ${c.field}: MISMATCH`);
          console.log(`         Ours: "${c.ours}"`);
          console.log(`         Live: "${c.live}"`);
        }
      }
      console.log();
    }
    console.log();
  }

  // ── Final Scorecard ──
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ACCURACY SCORECARD");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Total field checks:   ${totalChecked}`);
  console.log(`  ✅ Matches:           ${totalMatch}`);
  console.log(`  ❌ Mismatches:        ${totalMismatch}`);
  console.log(`  Accuracy:             ${((totalMatch / totalChecked) * 100).toFixed(1)}%`);
  console.log("═══════════════════════════════════════════════════════════════");

  await client.close();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
