/**
 * Ingests events for TODAY (April 11, 2026) from the live SB Engage API
 * into MongoDB Atlas with embeddings.
 */

import { MongoClient } from "mongodb";
import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";

const MONGO_URI = "mongodb+srv://abhavanishankar2002_db_user:ig7yaiY3xTJJ6v4M@cluster0.g8popj2.mongodb.net/?appName=Cluster0";
const GROQ_KEY = "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";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";

const groq = new Groq({ apiKey: GROQ_KEY });

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…").replace(/&rsquo;/g, "'").replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/\s+/g, " ").trim();
}

async function generateSummary(event) {
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: `You are a university event indexer. Create a dense keyword-rich summary (60-100 words) for vector search. Include: event type, topics, audience, mood, benefits, location type, time of day.

Title: ${event.title}
Description: ${event.description?.substring(0, 500)}
Location: ${event.location}
Organization: ${event.organization}
Benefits: ${event.benefits}
Categories: ${event.categories}
Theme: ${event.theme}

Dense search summary:` }],
    max_tokens: 200, temperature: 0.3,
  });
  return res.choices[0]?.message?.content ?? "";
}

async function main() {
  // Load embedder
  console.log("🧠 Loading embedding model...");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.log("✅ Embedding model ready\n");

  // Connect to MongoDB
  console.log("🔌 Connecting to MongoDB...");
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db("campus_events");
  console.log("✅ Connected\n");

  // Fetch today's events (April 11, 2026)
  const TODAY_START = "2026-04-11T00:00:00Z";
  const TODAY_END = "2026-04-12T00:00:00Z";

  console.log("📥 Fetching events for Saturday, April 11, 2026...\n");

  let allEvents = [];
  let skip = 0;
  const take = 50;

  while (true) {
    const params = new URLSearchParams({
      startsAfter: TODAY_START,
      startsBefore: TODAY_END,
      status: "Approved",
      take: String(take),
      skip: String(skip),
    });

    const res = await fetch(`${ENGAGE_API}?${params}`);
    const data = await res.json();
    const events = data.value || [];

    if (events.length === 0) break;
    allEvents = allEvents.concat(events);
    skip += take;

    if (events.length < take) break; // Last page
  }

  console.log(`📦 Found ${allEvents.length} events for today\n`);

  if (allEvents.length === 0) {
    // Try endsAfter instead — events that are still happening today
    console.log("⚠️  No events with startsAfter, trying endsAfter...\n");
    const params2 = new URLSearchParams({
      endsAfter: TODAY_START,
      startsBefore: TODAY_END,
      status: "Approved",
      take: "50",
    });
    const res2 = await fetch(`${ENGAGE_API}?${params2}`);
    const data2 = await res2.json();
    allEvents = data2.value || [];
    console.log(`📦 Found ${allEvents.length} events with endsAfter\n`);
  }

  // Process and ingest (limit to 25 to avoid rate limits)
  const toIngest = allEvents.slice(0, 25);
  let ingested = 0;

  for (const event of toIngest) {
    const title = event.name;
    const description = stripHtml(event.description);
    const location = event.location || "TBD";
    const organization = event.organizationName || "Unknown";
    const benefits = (event.benefitNames || []);
    const categories = (event.categoryNames || []);
    const theme = event.theme || "";
    const imageUrl = event.imagePath ? `https://se-images.campuslabs.com/clink/images/${event.imagePath}` : null;

    console.log(`  📝 [${ingested + 1}/${toIngest.length}] ${title}`);

    // Generate search summary
    const summary = await generateSummary({
      title, description, location, organization,
      benefits: benefits.join(", ") || "None",
      categories: categories.join(", ") || "None",
      theme,
    });

    // Generate embedding
    const result = await embedder(summary, { pooling: "mean", normalize: true });
    const embedding = Array.from(result.data);

    // Upsert into MongoDB
    const doc = {
      eventId: event.id.toString(),
      title,
      full_description: description,
      date: event.startsOn,
      end_date: event.endsOn,
      location,
      url: `https://stonybrook.campuslabs.com/engage/event/${event.id}`,
      image_url: imageUrl,
      search_summary: summary,
      embedding,
      categories,
      benefits,
      theme,
      organization,
      institution_id: event.institutionId || 0,
      ingested_at: new Date(),
    };

    await db.collection("events").updateOne(
      { eventId: doc.eventId },
      { $set: doc },
      { upsert: true }
    );

    ingested++;
    console.log(`     ✅ Ingested | 📍 ${location}`);
  }

  // Count total
  const total = await db.collection("events").countDocuments();
  console.log(`\n✅ Done! Ingested ${ingested} events for today.`);
  console.log(`📦 Total events in database: ${total}`);

  await client.close();
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
