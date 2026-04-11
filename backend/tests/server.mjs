/**
 * Standalone HTTP server that exposes the exact same search API
 * as the Next.js route. Avoids the Node 25 + Turbopack TLS issue.
 *
 * Usage: node tests/server.mjs
 * Then:  curl -X POST http://localhost:3001/api/search -H "Content-Type: application/json" -d '...'
 */

import http from "http";
import { MongoClient } from "mongodb";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

const PORT = 3001;
const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const GROQ_KEY = "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";

const groq = new Groq({ apiKey: GROQ_KEY });

// ── Helpers ──────────────────────────────────────────────────────────────────

function toET(iso) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "long", month: "long",
    day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }) + " ET";
}

function toETShort(iso) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "short", month: "short",
    day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }) + " ET";
}

async function generateText(prompt) {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400, temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? "";
}

// ── Boot ─────────────────────────────────────────────────────────────────────

console.log("🧠 Loading embedding model...");
const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
console.log("✅ Embedding model ready\n");

console.log("🔌 Connecting to MongoDB Atlas...");
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db("campus_events");
console.log("✅ MongoDB connected\n");

// ── Search Handler ───────────────────────────────────────────────────────────

async function handleSearch(query, currentDate) {
  // Step 1: HyDE
  const hydePrompt = `You are a university event search assistant.
Write a HYPOTHETICAL event summary (80-120 words) that would perfectly match this student's query.
Current date: ${currentDate} (Eastern Time).
Student query: "${query}"
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
        date: 1, end_date: 1, location: 1, url: 1, image_url: 1,
        categories: 1, benefits: 1, theme: 1, organization: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();

  // Step 4: Synthesis — Smart contextual reasoning prompt
  // Send ALL 6 results so the LLM can reason about perks, times, locations across the full set
  const synthEvents = results.slice(0, 6);
  const synthPrompt = `You are SB Engaged, the smart AI assistant for Stony Brook University campus events. You help students find the right events based on what they're actually looking for.

Today is ${currentDate} (Eastern Time). All times MUST be in Eastern Time (ET).

═══ YOUR REASONING APPROACH ═══

1. UNDERSTAND INTENT: What is the student really asking? Are they looking for:
   - A specific event or type of activity?
   - Something based on mood/feeling (stressed, bored, lonely)?
   - Events with specific perks (free food, giveaways)?
   - Events at a specific time or location?
   - General exploration of what's happening?

2. ANSWER THE ACTUAL QUESTION FIRST: Lead with a direct answer to what they asked.
   - If they ask "is there X?" → Answer yes/no first, then give details.
   - If they ask "where is X?" → Lead with the location.
   - If they ask "when is X?" → Lead with the time.
   - If they express a mood → Acknowledge it, then recommend with empathy.

3. EXPLAIN RELEVANCE: For each event you mention, briefly explain WHY it fits their query.
   Don't just list events — connect the dots for the student.

4. GIVE PRACTICAL DETAILS: Include the info they need to actually go:
   - Event name, time (ET), and location
   - Any perks (free food, free stuff, prizes)
   - How long it runs (so they know if they can still make it)

5. SUGGEST A NEXT STEP: End with something actionable:
   - "You could head over to [location] now to catch it!"
   - "I'd suggest trying [Event] first since it starts earlier."
   - "Check out the event cards below for more details and to RSVP."

═══ RULES ═══
- Be warm, conversational, and genuinely helpful — like a knowledgeable friend
- 3-5 sentences, concise but thorough
- NEVER fabricate events, times, locations, or details not in the data below
- NEVER include URLs (the UI shows clickable event cards separately)
- If the events don't perfectly match the query, be upfront: "I didn't find an exact match for X, but here's what's close..."
- If an event has already ended based on the current date/time, mention it
- Use the event's actual description to provide richer context, not just the title

═══ STUDENT QUESTION ═══
"${query}"

═══ MATCHING EVENTS FROM DATABASE (ranked by relevance) ═══
${synthEvents.map((e, i) => `[Event ${i + 1}${i < 2 ? " — TOP MATCH" : ""}]
Title: ${e.title}
Start: ${toET(e.date)}
End: ${toET(e.end_date)}
Location: ${e.location}
Description: ${e.full_description?.substring(0, 300)}
Organization: ${e.organization}
Categories: ${(e.categories || []).join(", ") || "N/A"}
Benefits: ${(e.benefits || []).join(", ") || "None listed"}`).join("\n\n")}

Your response:`;

  const aiResponse = await generateText(synthPrompt);

  // Step 5: Format response
  const fmt = (e) => ({
    ...e,
    date_et: toETShort(e.date),
    end_date_et: toETShort(e.end_date),
  });

  return {
    ai_response: aiResponse,
    primary_events: results.slice(0, 2).map(fmt),
    similar_events: results.slice(2, 6).map(fmt),
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/search") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { query, currentDate } = JSON.parse(body);
        if (!query || !currentDate) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing query or currentDate" }));
          return;
        }

        console.log(`\n🔍 Query: "${query}"`);
        const start = Date.now();
        const result = await handleSearch(query, currentDate);
        const elapsed = Date.now() - start;
        console.log(`   ✅ ${elapsed}ms | ${result.primary_events.length} primary, ${result.similar_events.length} similar`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error("Error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found. Use POST /api/search" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 SB Engaged API running on http://localhost:${PORT}/api/search`);
  console.log(`   Try: curl -X POST http://localhost:${PORT}/api/search -H "Content-Type: application/json" -d '{"query":"free food","currentDate":"Friday, April 10, 2026"}'`);
  console.log();
});
