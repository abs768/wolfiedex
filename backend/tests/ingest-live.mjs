/**
 * Live ingestion — Groq (text gen) + local MiniLM (embeddings) + MongoDB Atlas.
 * Usage: node tests/ingest-live.mjs
 */

import { MongoClient } from "mongodb";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const GROQ_KEY = "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";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";
const ENGAGE_EVENT_URL = "https://stonybrook.campuslabs.com/engage/event";
const IMAGE_CDN = "https://se-images.campuslabs.com/clink/images";

const groq = new Groq({ apiKey: GROQ_KEY });

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–").replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/\n{3,}/g, "\n\n").trim();
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

function buildSummaryPrompt(event, plainDesc) {
  return `You are a university event indexer. Produce a single dense paragraph (80-120 words) for search matching.
Pack in: event type, topics, target audience, benefits (food, prizes), time context, emotional hooks, hosting org.
Do NOT use bullet points. Write flowing prose.

Event: ${event.name}
Description: ${plainDesc.substring(0, 500)}
Date: ${event.startsOn} to ${event.endsOn}
Location: ${event.location}
Org: ${event.organizationName}
Categories: ${(event.categoryNames || []).join(", ") || "N/A"}
Theme: ${event.theme || "N/A"}
Benefits: ${(event.benefitNames || []).join(", ") || "N/A"}

Dense search summary:`;
}

async function main() {
  // Load local embedding model (one-time download ~30MB)
  console.log("🧠 Loading local embedding model (all-MiniLM-L6-v2)...");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.log("✅ Embedding model ready (384 dimensions)\n");

  async function embed(text) {
    const result = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(result.data);
  }

  console.log("📡 Fetching events from Stony Brook Engage API...");
  const params = new URLSearchParams({
    endsAfter: new Date().toISOString(),
    orderByField: "endsOn",
    orderByDirection: "ascending",
    status: "Approved",
    take: "20",
  });

  const res = await fetch(`${ENGAGE_API}?${params}`);
  const data = await res.json();
  console.log(`✅ Fetched ${data.value.length} events (${data["@odata.count"]} total upcoming)\n`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("campus_events");
  const collection = db.collection("events");

  // Remove placeholder
  await collection.deleteOne({ eventId: "_placeholder" });

  let ingested = 0;
  let failed = 0;

  for (const event of data.value) {
    try {
      const existing = await collection.findOne({ eventId: event.id.toString() });
      if (existing) {
        console.log(`  ⏭ Skip: ${event.name}`);
        continue;
      }

      const plainDesc = stripHtml(event.description || "");
      console.log(`  🔄 ${event.name}`);

      // Groq: generate search summary
      const summary = await generateText(buildSummaryPrompt(event, plainDesc));

      // Local: generate 384-d embedding
      const embedding = await embed(summary);

      const doc = {
        eventId: event.id.toString(),
        title: event.name,
        full_description: plainDesc,
        date: event.startsOn,
        end_date: event.endsOn,
        location: event.location || "TBD",
        url: `${ENGAGE_EVENT_URL}/${event.id}`,
        image_url: event.imagePath ? `${IMAGE_CDN}/${event.imagePath}` : "",
        search_summary: summary,
        embedding,
        categories: event.categoryNames || [],
        benefits: event.benefitNames || [],
        theme: event.theme || "",
        organization: event.organizationName,
        institution_id: event.institutionId,
        ingested_at: new Date(),
      };

      await collection.updateOne(
        { eventId: event.id.toString() },
        { $set: doc },
        { upsert: true }
      );

      ingested++;
      console.log(`     ✅ Done (${embedding.length}-d vector)\n`);
    } catch (err) {
      failed++;
      console.error(`     ❌ ${err.message}\n`);
    }
  }

  console.log("═══════════════════════════════════════");
  console.log(`📊 Done: ${ingested} ingested, ${failed} failed`);
  console.log("═══════════════════════════════════════");

  await client.close();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
