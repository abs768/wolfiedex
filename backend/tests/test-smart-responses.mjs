/**
 * Tests the QUALITY of AI responses — does it actually answer the question
 * with smart reasoning, relevance, and actionable suggestions?
 *
 * Usage: node tests/test-smart-responses.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const CURRENT_DATE = "Friday, April 10, 2026";

const TESTS = [
  // ── Direct Questions (expects yes/no + details) ──
  {
    query: "is there a hackathon today?",
    type: "YES/NO",
    expectation: "Should answer YES, mention Code-A-Site, give time + location",
  },
  {
    query: "are there any yoga classes today?",
    type: "YES/NO",
    expectation: "Should mention Slow Flow Stretch as closest match, be honest if not exactly yoga",
  },
  {
    query: "is there anything happening at the Union Ballroom?",
    type: "LOCATION",
    expectation: "Should confirm Code-A-Site is at Union Ballroom + give time",
  },

  // ── Where/When Questions ──
  {
    query: "where is the archery practice?",
    type: "WHERE",
    expectation: "Should lead with the location: Campus Recreation Outdoor South Field Complex",
  },
  {
    query: "when does the meditation event start?",
    type: "WHEN",
    expectation: "Should lead with the time: 4:00 PM ET at Yang Hall Lounge",
  },

  // ── Mood/Emotional Queries ──
  {
    query: "I just bombed my midterm and feel terrible, is there anything to cheer me up",
    type: "EMOTIONAL",
    expectation: "Should acknowledge feelings, recommend something fun or relaxing",
  },
  {
    query: "I'm new on campus and don't know anyone, what can I go to to meet people",
    type: "EMOTIONAL",
    expectation: "Should recommend social/group events, be welcoming",
  },

  // ── Perk-Specific Queries ──
  {
    query: "where can I get free food on campus right now",
    type: "PERK",
    expectation: "Should specifically mention events with 'Free Food' benefit",
  },
  {
    query: "any events giving away free stuff today?",
    type: "PERK",
    expectation: "Should mention Meditate & Mist (Free Stuff) and Code-A-Site (Free Food)",
  },

  // ── Comparison / Decision Queries ──
  {
    query: "I have free time from 3 to 5pm, what's the best thing I could go to?",
    type: "DECISION",
    expectation: "Should filter by time window and recommend the best option",
  },
  {
    query: "should I go to the escape room or the scavenger hunt?",
    type: "COMPARISON",
    expectation: "Should compare both events and help the student decide",
  },

  // ── Specific Detail Questions ──
  {
    query: "tell me more about the CPO sexting consent event, what exactly happens there",
    type: "DETAIL",
    expectation: "Should pull from the description to explain what the event is about",
  },
  {
    query: "what organization is hosting the campus beautification day?",
    type: "DETAIL",
    expectation: "Should mention Fraternity and Sorority Life",
  },

  // ── Edge Cases ──
  {
    query: "are there any concerts or live music today",
    type: "NO MATCH",
    expectation: "Should honestly say no concerts found, suggest alternatives",
  },
  {
    query: "what's happening tomorrow or this weekend",
    type: "TEMPORAL",
    expectation: "Should be honest that it only has today's events, show what's available",
  },
];

async function runTest(test, num) {
  console.log(`\n${"━".repeat(80)}`);
  console.log(`  TEST ${num} [${test.type}]`);
  console.log(`  Q: "${test.query}"`);
  console.log(`  Expected: ${test.expectation}`);
  console.log(`${"━".repeat(80)}\n`);

  const start = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: test.query, currentDate: CURRENT_DATE }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();

  console.log(`  💬 AI RESPONSE (${elapsed}ms):`);
  console.log(`  ┌${"─".repeat(74)}┐`);
  // Word wrap the response for readability
  const words = data.ai_response.split(" ");
  let line = "  │ ";
  for (const word of words) {
    if (line.length + word.length > 76) {
      console.log(line.padEnd(77) + "│");
      line = "  │ " + word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line.trim() !== "│") console.log(line.padEnd(77) + "│");
  console.log(`  └${"─".repeat(74)}┘`);

  console.log(`\n  📋 Events returned:`);
  for (const e of (data.primary_events || [])) {
    console.log(`     🟢 ${e.title} | ${e.date_et} → ${e.end_date_et} | 📍 ${e.location} | 🎁 ${(e.benefits||[]).join(", ")||"—"}`);
  }
  for (const e of (data.similar_events || [])) {
    console.log(`     🔵 ${e.title} | ${e.date_et} | 📍 ${e.location}`);
  }

  return { query: test.query, type: test.type, elapsed, response: data.ai_response };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log("  SB ENGAGED — Smart Response Quality Test");
  console.log("  Testing: Does the AI actually answer questions with relevant reasoning?");
  console.log("═══════════════════════════════════════════════════════════════════════════════");

  const results = [];
  for (let i = 0; i < TESTS.length; i++) {
    results.push(await runTest(TESTS[i], i + 1));
  }

  console.log(`\n\n${"═".repeat(80)}`);
  console.log("  RESPONSE QUALITY SUMMARY");
  console.log(`${"═".repeat(80)}`);
  const avgTime = Math.round(results.reduce((a, r) => a + r.elapsed, 0) / results.length);
  console.log(`  Total queries: ${results.length}`);
  console.log(`  Avg response time: ${avgTime}ms`);
  console.log(`\n  Review each response above to verify quality.`);
  console.log(`${"═".repeat(80)}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
