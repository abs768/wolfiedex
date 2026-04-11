// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE B — Search Orchestrator (HyDE Implementation)
// POST /api/search
// ═══════════════════════════════════════════════════════════════════════════════
//
// DATA FLOW:
//   1. User sends { query, currentDate } from the frontend
//   2. HyDE (Groq): LLM imagines a hypothetical event that perfectly answers
//      the query — this bridges the vocabulary gap between casual questions
//      and formal event descriptions
//   3. Embed (Local MiniLM): Vectorize the hypothetical into 384-d space
//   4. Retrieve (Atlas $vectorSearch): Find top 6 real events closest to the
//      hypothetical in vector space
//   5. Synthesize (Groq): Pass original query + top 2 events to LLM for a
//      conversational answer
//   6. Return: ai_response + primary_events (top 2) + similar_events (3-6)
//
// WHY HyDE?
//   A student types: "anything fun this weekend with free food?"
//   Direct embedding of this short query matches poorly against dense summaries.
//   HyDE expands it into: "Weekend campus social event with complimentary pizza,
//   snacks, and refreshments. Casual entertainment gathering..."
//   This hypothetical lives in the same semantic space as our indexed summaries,
//   dramatically improving retrieval quality.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { generateText, generateEmbedding } from "@/lib/ai";
import { toEastern, toEasternShort } from "@/lib/time";
import type { EventDocument, SearchResponse } from "@/lib/types";

// ── Groq System Prompts ──────────────────────────────────────────────────────

/**
 * HyDE Prompt — asks Groq/Llama to imagine a realistic event summary
 * that would perfectly satisfy the user's query. The output is never shown
 * to the user; it's only used as a "query expansion" for vector search.
 */
function buildHyDEPrompt(query: string, currentDate: string): string {
  return `You are a university event search assistant. A student is searching for events.

Given their query, write a HYPOTHETICAL event summary (80-120 words) that would be the PERFECT match. Write it as if you are describing a real campus event that exists.

Include realistic details:
- Event type, format, and topics
- Target audience
- Benefits (food, prizes, networking, certificates)
- Time of day and setting
- Emotional tone matching the query intent

The current date is ${currentDate} (Eastern Time). Make the hypothetical event feel timely and relevant.

Student query: "${query}"

Hypothetical event summary:`;
}

/**
 * Synthesis Prompt — generates the conversational AI response shown to the
 * user. Receives the original query and the REAL event data retrieved from
 * MongoDB, ensuring the answer is grounded in facts (not hallucinated).
 *
 * This prompt is designed for smart, contextual reasoning:
 * - Directly answers what the student asked
 * - Highlights WHY each event is relevant to their specific question
 * - Surfaces key details (free food, location, timing) based on intent
 * - Provides actionable next-step suggestions
 * - Handles edge cases (no match, events ended, emotional queries)
 */
function buildSynthesisPrompt(
  query: string,
  currentDate: string,
  events: EventDocument[]
): string {
  const eventContext = events
    .map(
      (e, i) =>
        `[Event ${i + 1}]
Title: ${e.title}
Start: ${toEastern(e.date)}
End: ${toEastern(e.end_date)}
Location: ${e.location}
Organization: ${e.organization}
Description: ${e.full_description}
Categories: ${e.categories.join(", ") || "N/A"}
Benefits: ${e.benefits.join(", ") || "None listed"}
URL: ${e.url}`
    )
    .join("\n\n");

  return `You are SB Engaged, the smart AI assistant for Stony Brook University campus events. You help students find the right events based on what they're actually looking for.

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
   - "Since you mentioned free food, Code-A-Site has complimentary snacks and drinks..."
   - "If you're looking to de-stress, Meditate & Mist offers guided meditation..."

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
- If an event has already ended based on the current date/time, mention it: "This one already wrapped up earlier today, but..."
- Use the event's actual description to provide richer context, not just the title

═══ STUDENT QUESTION ═══
"${query}"

═══ MATCHING EVENTS FROM DATABASE ═══
${eventContext}

Your response:`;
}

// ── POST /api/search ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, currentDate } = body as {
      query: string;
      currentDate: string;
    };

    if (!query || !currentDate) {
      return NextResponse.json(
        { error: "Missing required fields: query, currentDate" },
        { status: 400 }
      );
    }

    // ── Step 1: HyDE — Generate a hypothetical perfect-match summary ────
    // The LLM "imagines" what an ideal event would look like for this query.
    // This hypothetical is never shown to the user.
    const hypotheticalSummary = await generateText(
      buildHyDEPrompt(query, currentDate)
    );

    // ── Step 2: Embed the hypothetical summary ──────────────────────────
    // Convert the hypothetical into a 384-d vector in the same embedding
    // space as our indexed search_summary vectors.
    const queryVector = await generateEmbedding(hypotheticalSummary);

    // ── Step 3: Vector search against MongoDB Atlas ─────────────────────
    // $vectorSearch compares our HyDE vector against all event embeddings
    // using cosine similarity, returning the top 6 closest matches.
    const { db } = await connectToDatabase();
    const collection = db.collection<EventDocument>("events");

    const results = await collection
      .aggregate<EventDocument & { score: number }>([
        {
          $vectorSearch: {
            index: "event_vector_index",    // Atlas vector search index name
            path: "embedding",              // Field containing event vectors
            queryVector,                    // Our HyDE vector
            numCandidates: 50,              // Pre-filter pool for accuracy
            limit: 6,                       // Return top 6 results
          },
        },
        {
          // Project all display fields + the similarity score.
          // Explicitly exclude the raw embedding array (large, not needed).
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
            theme: 1,
            organization: 1,
            institution_id: 1,
            ingested_at: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    // ── Split into primary (top 2) and similar (3-6) ────────────────────
    // Primary: shown as main results with full details + AI commentary
    // Similar: shown as "You might also like" cards — FREE, no extra LLM call
    const addEasternTime = (e: EventDocument & { score: number }) => ({
      ...e,
      date_et: toEasternShort(e.date),
      end_date_et: toEasternShort(e.end_date),
    });

    const primaryEvents = results.slice(0, 2).map(addEasternTime);
    const similarEvents = results.slice(2, 6).map(addEasternTime);

    // ── Step 4: Synthesize a conversational answer from all 6 results ───
    // All 6 results are sent to the LLM so it can reason across the full
    // set — important for perk-specific queries (free food), location
    // matching, and time-window filtering.
    let aiResponse = "I couldn't find any events matching your query. Try a broader search!";
    const allResults = [...primaryEvents, ...similarEvents];
    if (allResults.length > 0) {
      aiResponse = await generateText(
        buildSynthesisPrompt(query, currentDate, allResults)
      );
    }

    // ── Step 5: Return structured JSON ──────────────────────────────────
    const response: SearchResponse = {
      ai_response: aiResponse,
      primary_events: primaryEvents,
      similar_events: similarEvents,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 }
    );
  }
}
