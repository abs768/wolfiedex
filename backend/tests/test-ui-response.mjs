/**
 * Shows the FULL JSON response for each query — exactly what the frontend receives.
 * Helps evaluate whether the data is good enough to populate in the UI.
 *
 * Usage: node tests/test-ui-response.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const CURRENT_DATE = "Friday, April 10, 2026";

const QUERIES = [
  "any events with free food today?",
  "I'm feeling stressed, anything relaxing?",
  "is there a hackathon or coding event today",
  "where can I play sports on campus right now",
  "anything fun happening in SAC today",
];

async function main() {
  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  QUERY ${i + 1}: "${query}"`);
    console.log(`${"═".repeat(80)}\n`);

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, currentDate: CURRENT_DATE }),
    });

    const data = await res.json();

    // Show the full response structure
    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  AI RESPONSE (what you'd show in the chat bubble)              │");
    console.log("└─────────────────────────────────────────────────────────────────┘");
    console.log(`\n${data.ai_response}\n`);

    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  PRIMARY EVENTS (top cards in UI)                              │");
    console.log("└─────────────────────────────────────────────────────────────────┘\n");

    for (const e of (data.primary_events || [])) {
      console.log(`  ┌${"─".repeat(65)}┐`);
      console.log(`  │ TITLE:        ${e.title}`);
      console.log(`  │ DATE:         ${e.date_et}`);
      console.log(`  │ END:          ${e.end_date_et}`);
      console.log(`  │ LOCATION:     ${e.location}`);
      console.log(`  │ ORGANIZATION: ${e.organization}`);
      console.log(`  │ BENEFITS:     ${(e.benefits || []).join(", ") || "None"}`);
      console.log(`  │ CATEGORIES:   ${(e.categories || []).join(", ") || "None"}`);
      console.log(`  │ IMAGE:        ${e.image_url || "No image"}`);
      console.log(`  │ URL:          ${e.url}`);
      console.log(`  │ EVENT ID:     ${e.eventId}`);
      console.log(`  │ SCORE:        ${e.score?.toFixed(4) || "N/A"}`);
      console.log(`  │ DESCRIPTION:  ${(e.full_description || "").substring(0, 150)}...`);
      console.log(`  └${"─".repeat(65)}┘`);
      console.log();
    }

    console.log("┌─────────────────────────────────────────────────────────────────┐");
    console.log("│  SIMILAR EVENTS (smaller cards / list below)                   │");
    console.log("└─────────────────────────────────────────────────────────────────┘\n");

    for (const e of (data.similar_events || [])) {
      console.log(`  • ${e.title}`);
      console.log(`    ${e.date_et} → ${e.end_date_et} | 📍 ${e.location}`);
      console.log(`    🏢 ${e.organization} | 🎁 ${(e.benefits || []).join(", ") || "None"}`);
      console.log(`    🔗 ${e.url}`);
      console.log(`    🖼️  ${e.image_url || "No image"}`);
      console.log();
    }

    // Show the raw JSON structure for one query
    if (i === 0) {
      console.log("┌─────────────────────────────────────────────────────────────────┐");
      console.log("│  RAW JSON (exactly what fetch('/api/search') returns)          │");
      console.log("└─────────────────────────────────────────────────────────────────┘\n");

      // Clean copy with truncated descriptions for readability
      const clean = {
        ai_response: data.ai_response,
        primary_events: data.primary_events.map(e => ({
          eventId: e.eventId,
          title: e.title,
          date: e.date,
          end_date: e.end_date,
          date_et: e.date_et,
          end_date_et: e.end_date_et,
          location: e.location,
          organization: e.organization,
          benefits: e.benefits,
          categories: e.categories,
          image_url: e.image_url,
          url: e.url,
          theme: e.theme,
          score: e.score,
          full_description: (e.full_description || "").substring(0, 100) + "...",
        })),
        similar_events: data.similar_events.map(e => ({
          eventId: e.eventId,
          title: e.title,
          date_et: e.date_et,
          end_date_et: e.end_date_et,
          location: e.location,
          organization: e.organization,
          benefits: e.benefits,
          categories: e.categories,
          image_url: e.image_url,
          url: e.url,
          score: e.score,
        })),
      };
      console.log(JSON.stringify(clean, null, 2));
    }
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
