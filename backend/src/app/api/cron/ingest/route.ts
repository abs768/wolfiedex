// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE A — Ingestion Worker
// POST /api/cron/ingest
// ═══════════════════════════════════════════════════════════════════════════════
//
// DATA FLOW:
//   1. Fetch upcoming events from the live Anthology Engage API (public GET)
//   2. For each new event:
//      a. Strip HTML from the description
//      b. Send to Groq (Llama 3.3 70B) → dense keyword search_summary
//      c. Send search_summary to local MiniLM → 384-d embedding vector
//      d. Upsert the full document into MongoDB Atlas
//   3. The vector index on Atlas automatically indexes the new embedding
//
// TRIGGER: GitHub Actions cron job (daily) or manual POST with CRON_SECRET
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { generateText, generateEmbedding } from "@/lib/ai";
import type { EngageSearchResponse, EngageEvent, EventDocument } from "@/lib/types";

// ── Configuration ────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Stony Brook's Anthology Engage discovery API.
 * This is the public JSON endpoint their frontend uses — no auth required.
 * Swap the subdomain for any other CampusLabs institution.
 */
const ENGAGE_BASE_URL =
  process.env.ENGAGE_BASE_URL ??
  "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";

const ENGAGE_EVENT_PAGE =
  process.env.ENGAGE_EVENT_PAGE_URL ??
  "https://stonybrook.campuslabs.com/engage/event";

const ENGAGE_IMAGE_CDN = "https://se-images.campuslabs.com/clink/images";

/** Events per page (API supports up to 1000) */
const PAGE_SIZE = 100;

/** Safety cap — don't ingest more than this in a single run */
const MAX_EVENTS = 500;

// ── HTML → Plain Text ────────────────────────────────────────────────────────

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
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Groq Prompt: Dense Search Summary ────────────────────────────────────────
//
// This is the key to Multi-Representation Indexing. We ask the LLM to compress
// the event into a keyword-rich paragraph optimized for semantic search,
// separate from the raw description the user sees.

function buildSummaryPrompt(event: EngageEvent, plainDesc: string): string {
  return `You are a university event indexer. Produce a single dense paragraph (80-120 words) that a student search engine will use to match queries.

Pack in:
- Event type, topic, and themes
- Target audience and skill levels
- Tangible benefits (food, prizes, certificates, networking)
- Time context (day of week, morning/evening, duration)
- Emotional hooks (fun, career-boosting, relaxing, competitive)
- The hosting organization name

Do NOT use bullet points. Write flowing prose. Do NOT include the event title verbatim.

Event Title: ${event.name}
Description: ${plainDesc.substring(0, 500)}
Date: ${event.startsOn} to ${event.endsOn}
Location: ${event.location}
Organization: ${event.organizationName}
Categories: ${(event.categoryNames || []).join(", ") || "N/A"}
Theme: ${event.theme || "N/A"}
Benefits: ${(event.benefitNames || []).join(", ") || "N/A"}

Dense search summary:`;
}

// ── Fetch Events from Live Engage API (Paginated) ────────────────────────────

async function fetchAllUpcomingEvents(): Promise<EngageEvent[]> {
  const allEvents: EngageEvent[] = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount && allEvents.length < MAX_EVENTS) {
    const params = new URLSearchParams({
      endsAfter: new Date().toISOString(),
      orderByField: "endsOn",
      orderByDirection: "ascending",
      status: "Approved",
      take: String(PAGE_SIZE),
      skip: String(skip),
    });

    const url = `${ENGAGE_BASE_URL}?${params}`;
    console.log(`📡 Fetching: ${url}`);

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Engage API returned ${res.status}: ${await res.text()}`);
    }

    const data: EngageSearchResponse = await res.json();
    totalCount = data["@odata.count"];
    allEvents.push(...data.value);
    skip += PAGE_SIZE;

    console.log(
      `   Fetched ${data.value.length} events (${allEvents.length}/${totalCount} total)`
    );
  }

  return allEvents;
}

// ── POST /api/cron/ingest ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Verify cron secret (skip in dev if not set)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch events from the live Engage API
    const events = await fetchAllUpcomingEvents();

    // 2. Connect to MongoDB
    const { db } = await connectToDatabase();
    const collection = db.collection<EventDocument>("events");
    await collection.createIndex({ eventId: 1 }, { unique: true });

    let upserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events) {
      try {
        // Skip events already in the database
        const existing = await collection.findOne({
          eventId: event.id.toString(),
        });
        if (existing) {
          skipped++;
          continue;
        }

        // 2a. Strip HTML → plain text
        const plainDesc = stripHtml(event.description || "");

        // 2b. Groq: generate dense search summary
        const search_summary = await generateText(
          buildSummaryPrompt(event, plainDesc)
        );

        // 2c. Local MiniLM: generate 384-d embedding of the summary
        const embedding = await generateEmbedding(search_summary);

        // 2d. Build URLs
        const eventUrl = `${ENGAGE_EVENT_PAGE}/${event.id}`;
        const imageUrl = event.imagePath
          ? `${ENGAGE_IMAGE_CDN}/${event.imagePath}`
          : "";

        // 2e. Upsert into MongoDB
        const doc: EventDocument = {
          eventId: event.id.toString(),
          title: event.name,
          full_description: plainDesc,
          date: event.startsOn,
          end_date: event.endsOn,
          location: event.location || "TBD",
          url: eventUrl,
          image_url: imageUrl,
          search_summary,
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

        upserted++;
        console.log(`   ✅ ${event.name}`);
      } catch (err) {
        failed++;
        console.error(`   ❌ ${event.name}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      total_fetched: events.length,
      upserted,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: "Ingestion failed", details: String(error) },
      { status: 500 }
    );
  }
}
