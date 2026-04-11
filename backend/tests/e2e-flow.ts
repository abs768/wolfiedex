/**
 * End-to-End Flow Test
 *
 * Simulates EXACTLY what happens when a user types
 * "what anime themed events are there this week?" in the SB Engaged UI
 * and clicks Search.
 *
 * Uses the LIVE Stony Brook Engage API + mocked LLM/embedding layer.
 *
 * Usage:  npx tsx tests/e2e-flow.ts
 */

import type { EngageSearchResponse, EngageEvent, EventDocument } from "../src/lib/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const ENGAGE_API =
  "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";
const ENGAGE_EVENT_URL =
  "https://stonybrook.campuslabs.com/engage/event";
const IMAGE_CDN = "https://se-images.campuslabs.com/clink/images";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mockEmbed(text: string): number[] {
  const vec = new Array(768).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 768] += text.charCodeAt(i) / 1000;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / mag);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── PHASE 1: Ingest from LIVE Engage API ────────────────────────────────────

async function ingestFromLiveAPI(): Promise<EventDocument[]> {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 1: LIVE INGESTION from Stony Brook Engage API       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const params = new URLSearchParams({
    endsAfter: new Date().toISOString(),
    orderByField: "endsOn",
    orderByDirection: "ascending",
    status: "Approved",
    take: "100",
  });

  const url = `${ENGAGE_API}?${params}`;
  console.log(`📡 GET ${url}\n`);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API returned ${res.status}`);

  const data: EngageSearchResponse = await res.json();
  console.log(`✅ Fetched ${data.value.length} events (${data["@odata.count"]} total upcoming)\n`);

  // Simulate the ingestion pipeline for each event
  const store: EventDocument[] = [];

  for (const event of data.value) {
    const plainDesc = stripHtml(event.description || "");

    // In production: LLM generates this. Here we build a keyword-rich proxy.
    const search_summary = [
      event.name,
      plainDesc,
      event.organizationName,
      event.theme,
      ...event.categoryNames,
      ...event.benefitNames,
      event.location,
    ]
      .filter(Boolean)
      .join(" ");

    const embedding = mockEmbed(search_summary);

    store.push({
      eventId: event.id,
      title: event.name,
      full_description: plainDesc,
      date: event.startsOn,
      end_date: event.endsOn,
      location: event.location || "TBD",
      url: `${ENGAGE_EVENT_URL}/${event.id}`,
      image_url: event.imagePath ? `${IMAGE_CDN}/${event.imagePath}` : "",
      search_summary,
      embedding,
      categories: event.categoryNames,
      benefits: event.benefitNames,
      theme: event.theme || "",
      organization: event.organizationName,
      institution_id: event.institutionId,
      ingested_at: new Date(),
    });
  }

  console.log(`📦 Ingested ${store.length} events into simulated vector store.\n`);
  return store;
}

// ─── PHASE 2: Full Search Pipeline ───────────────────────────────────────────

function runSearch(
  store: EventDocument[],
  query: string,
  currentDate: string
) {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  PHASE 2: SEARCH PIPELINE                                  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // ── What the frontend sends ──
  const requestBody = { query, currentDate };
  console.log("📤 FRONTEND REQUEST");
  console.log("   POST /api/search");
  console.log("   Body:", JSON.stringify(requestBody, null, 2).replace(/\n/g, "\n   "));
  console.log();

  // ── Step 1: HyDE — LLM generates a hypothetical perfect-match event ──
  console.log("─── Step 1: HyDE (Hypothetical Document Embedding) ───────────\n");

  const hydePrompt = `You are a university event search assistant. A student is searching for events.

Given their query, write a HYPOTHETICAL event summary (80-120 words) that would be the PERFECT match.

Student query: "${query}"`;

  console.log("   Prompt sent to Gemini 2.0 Flash:");
  console.log("   " + hydePrompt.split("\n").join("\n   "));
  console.log();

  // Simulated LLM output for this specific query
  const hypotheticalSummary =
    "Anime themed campus event featuring Japanese animation screenings, manga reading sessions, cosplay activities, and Japanese cultural entertainment. Watch party with popular anime series and films in a casual social setting. Hosted by anime club or Asian cultural organization. Japanese snacks and themed refreshments provided. Evening weekend event perfect for otaku students and anyone interested in Japanese pop culture, art, and animation. Fun community gathering celebrating anime fandom with like-minded students, trivia games, and discussions about trending shows.";

  console.log("   🔮 LLM Generated Hypothetical Summary:");
  console.log(`   "${hypotheticalSummary}"\n`);

  // ── Step 2: Embed the hypothetical ──
  console.log("─── Step 2: Embed Hypothetical Summary ───────────────────────\n");

  const queryVector = mockEmbed(hypotheticalSummary);
  console.log(
    `   🧬 Vector: [${queryVector.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}, ...] (768 dimensions)\n`
  );

  // ── Step 3: $vectorSearch against MongoDB Atlas ──
  console.log("─── Step 3: MongoDB $vectorSearch ────────────────────────────\n");

  console.log("   Aggregation pipeline:");
  console.log(`   [
     { $vectorSearch: {
         index: "event_vector_index",
         path: "embedding",
         queryVector: <768-d float array>,
         numCandidates: 50,
         limit: 6
       }
     },
     { $project: { _id: 0, eventId: 1, title: 1, ... , score: { $meta: "vectorSearchScore" } } }
   ]\n`);

  // Simulate vector search via cosine similarity
  const scored = store
    .map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryVector, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  console.log("   📊 Top 6 Results (ranked by cosine similarity):\n");
  scored.forEach((e, i) => {
    const tag = i < 2 ? "🟢 PRIMARY" : "🔵 SIMILAR";
    console.log(
      `   ${i + 1}. ${tag}  score=${e.score.toFixed(4)}  "${e.title}"`
    );
    console.log(`      Org: ${e.organization} | Date: ${e.date} | Location: ${e.location}`);
    if (e.benefits.length) console.log(`      Benefits: ${e.benefits.join(", ")}`);
    console.log();
  });

  // ── Step 4: Synthesis — LLM generates conversational answer ──
  console.log("─── Step 4: Synthesis (Conversational Answer) ─────────────────\n");

  const top2 = scored.slice(0, 2);
  const synthesisPrompt = `You are a friendly university events assistant.

Student question: "${query}"

Matching events:
${top2
  .map(
    (e, i) => `[Event ${i + 1}]
Title: ${e.title}
Date: ${e.date}
Location: ${e.location}
Description: ${e.full_description.substring(0, 300)}
Organization: ${e.organization}`
  )
  .join("\n\n")}

Your response:`;

  console.log("   Prompt sent to Gemini 2.0 Flash (with top 2 events injected):");
  console.log("   " + synthesisPrompt.split("\n").join("\n   "));
  console.log();

  // Simulated synthesis for this query
  const aiResponse = `Great question! While I didn't find dedicated anime-only events this week, here are the closest cultural and entertainment events at Stony Brook: **${top2[0].title}** by ${top2[0].organization} on ${new Date(top2[0].date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${top2[0].location} — ${top2[0].full_description.substring(0, 100)}. You might also check out **${top2[1].title}** at ${top2[1].location}. Keep an eye on SB Engaged for any anime club screenings popping up later this week!`;

  console.log("   💬 LLM Synthesized Response:");
  console.log(`   "${aiResponse}"\n`);

  // ── Step 5: Final JSON Response ──
  console.log("─── Step 5: API Response to Frontend ──────────────────────────\n");

  const primaryEvents = scored.slice(0, 2).map(({ score, embedding, search_summary, ...rest }) => rest);
  const similarEvents = scored.slice(2, 6).map(({ score, embedding, search_summary, ...rest }) => rest);

  const response = {
    ai_response: aiResponse,
    primary_events: primaryEvents.map((e) => ({
      eventId: e.eventId,
      title: e.title,
      date: e.date,
      end_date: e.end_date,
      location: e.location,
      url: e.url,
      image_url: e.image_url,
      organization: e.organization,
      categories: e.categories,
      benefits: e.benefits,
    })),
    similar_events: similarEvents.map((e) => ({
      eventId: e.eventId,
      title: e.title,
      date: e.date,
      location: e.location,
      url: e.url,
      organization: e.organization,
    })),
  };

  console.log("   📥 RESPONSE  200 OK\n");
  console.log(JSON.stringify(response, null, 2));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log();
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log("  │  SB ENGAGED — End-to-End Flow Test                     │");
  console.log("  │  Query: \"what anime themed events are there this week?\" │");
  console.log("  └─────────────────────────────────────────────────────────┘");
  console.log();

  const store = await ingestFromLiveAPI();
  runSearch(store, "what anime themed events are there this week?", "2026-04-10");
}

main().catch(console.error);
