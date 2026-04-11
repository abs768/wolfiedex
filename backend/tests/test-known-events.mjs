/**
 * Tests with queries targeting SPECIFIC known events in the database.
 * Validates:
 *   1. Can the system find the exact event being asked about?
 *   2. Are the similar events semantically relevant?
 *   3. Does the AI response make sense and reference the right event?
 *
 * Usage: node tests/test-known-events.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";
const CURRENT_DATE = "Friday, April 10, 2026";

// ── All 20 known events in our DB ───────────────────────────────────────────
const KNOWN_EVENTS = [
  "Fashion Show Readiness",
  "Code-A-Site",
  "Campus Beautification Day",
  "Long Island Aquarium Trip",
  "Outdoor Archery Practice",
  "Table Tennis Club Practice",
  "CPO Expert Series: Sexting, Consent and Safety with Planned Parenthood Hudson Peconic",
  "DnD and More! campaign meeting",
  'The Art of Saying "No"',
  "Badminton Club Weekly Meeting",
  "Survivor Advocate Chat",
  "Easter Scavenger Hunt!",
  "Competitive Team Tennis Practice",
  "Mindful Moments: Slow Flow Stretch!",
  "Escape Room",
  "Meditate & Mist",
  "Quiz Bowl and Trivia Club GBM",
  "Web Dev Recurring EBM Room",
  "Stony Brook Running Club",
  "Abolish Everything!",
];

// ── Relevance groups: events that SHOULD cluster together ────────────────────
const RELEVANCE_GROUPS = {
  "wellness": ["Meditate & Mist", "Mindful Moments: Slow Flow Stretch!", "Survivor Advocate Chat", "The Art of Saying \"No\""],
  "sports": ["Badminton Club Weekly Meeting", "Competitive Team Tennis Practice", "Table Tennis Club Practice", "Stony Brook Running Club", "Outdoor Archery Practice"],
  "tech": ["Code-A-Site", "Web Dev Recurring EBM Room"],
  "games": ["Escape Room", "Easter Scavenger Hunt!", "DnD and More! campaign meeting", "Quiz Bowl and Trivia Club GBM", "Abolish Everything!"],
};

async function fetchLiveEvent(name) {
  const params = new URLSearchParams({
    endsAfter: "2026-04-10T00:00:00Z", query: name.substring(0, 40),
    status: "Approved", take: "5",
  });
  const res = await fetch(`${ENGAGE_API}?${params}`);
  const data = await res.json();
  return data.value || [];
}

function findRelevanceGroup(eventTitle) {
  const normalized = eventTitle.replace(/\s+/g, " ").trim();
  for (const [group, members] of Object.entries(RELEVANCE_GROUPS)) {
    if (members.some(m => normalized.includes(m) || m.includes(normalized))) return group;
  }
  return null;
}

async function testQuery(query, queryNum, expectedEvent, expectedGroup) {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  TEST ${queryNum}: "${query}"`);
  console.log(`║  🎯 Expected: "${expectedEvent}"`);
  console.log(`║  🏷️  Group: ${expectedGroup || "general"}`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  const start = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, currentDate: CURRENT_DATE }),
  });
  const elapsed = Date.now() - start;

  if (!res.ok) {
    console.log(`   ❌ HTTP ${res.status}: ${await res.text()}`);
    return { found: false, relevantSimilar: 0, totalSimilar: 0, elapsed, verified: 0, verifiedOk: 0 };
  }

  const data = await res.json();
  console.log(`   ⏱️  ${elapsed}ms\n`);

  // AI Response
  console.log(`💬 AI Response:`);
  console.log(`   "${data.ai_response}"\n`);

  const allEvents = [...(data.primary_events || []), ...(data.similar_events || [])];
  const allTitles = allEvents.map(e => e.title.trim());

  // CHECK 1: Was the expected event found?
  const found = allTitles.some(t =>
    t.includes(expectedEvent) || expectedEvent.includes(t) ||
    t.toLowerCase().includes(expectedEvent.toLowerCase()) ||
    expectedEvent.toLowerCase().includes(t.toLowerCase())
  );
  const isPrimary = (data.primary_events || []).some(e =>
    e.title.includes(expectedEvent) || expectedEvent.includes(e.title)
  );

  if (found) {
    console.log(`   🎯 Target event: ✅ FOUND ${isPrimary ? "(PRIMARY)" : "(SIMILAR)"}`);
  } else {
    console.log(`   🎯 Target event: ❌ NOT FOUND`);
    console.log(`      Returned: ${allTitles.join(" | ")}`);
  }

  // CHECK 2: Are similar events semantically relevant?
  let relevantSimilar = 0;
  if (expectedGroup && RELEVANCE_GROUPS[expectedGroup]) {
    const groupMembers = RELEVANCE_GROUPS[expectedGroup];
    for (const e of allEvents) {
      if (groupMembers.some(m => e.title.includes(m) || m.includes(e.title))) {
        relevantSimilar++;
      }
    }
    console.log(`   🔗 Relevant similar: ${relevantSimilar}/${allEvents.length} events from "${expectedGroup}" group`);
  }

  // CHECK 3: Does AI response mention the event by name?
  const aiMentionsEvent = data.ai_response?.toLowerCase().includes(expectedEvent.toLowerCase().substring(0, 15));
  console.log(`   💬 AI mentions target: ${aiMentionsEvent ? "✅ Yes" : "⚠️  No"}`);

  // CHECK 4: Cross-verify all returned events against live API
  let verified = 0, verifiedOk = 0;
  console.log(`\n   📋 All returned events:`);
  for (const e of allEvents) {
    const liveResults = await fetchLiveEvent(e.title);
    const live = liveResults.find(l => l.id?.toString() === e.eventId)
      || liveResults.find(l => l.name === e.title);

    const isTarget = e.title.includes(expectedEvent) || expectedEvent.includes(e.title);
    const group = findRelevanceGroup(e.title);
    const groupTag = group ? `[${group}]` : "";
    const targetTag = isTarget ? " 🎯" : "";

    if (live) {
      const ok = e.title === live.name && e.location === live.location;
      verified += 2;
      verifiedOk += (e.title === live.name ? 1 : 0) + (e.location === live.location ? 1 : 0);
      console.log(`   ${ok ? "✅" : "⚠️"} ${e.title} | 📍 ${e.location} ${groupTag}${targetTag}`);
    } else {
      console.log(`   ❓ ${e.title} | 📍 ${e.location} ${groupTag}${targetTag} (not in live API)`);
    }
  }

  console.log();
  return { found, isPrimary, relevantSimilar, totalSimilar: allEvents.length, elapsed, verified, verifiedOk, aiMentionsEvent };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SB ENGAGED — Known Event Retrieval & Relevance Test");
  console.log("  Testing: Can it find specific events + suggest relevant ones?");
  console.log("═══════════════════════════════════════════════════════════════");

  // Each test: [query, expected event to find, expected relevance group]
  const TESTS = [
    // 1. Exact event name lookup
    ["Tell me about Code-A-Site", "Code-A-Site", "tech"],

    // 2. Describe the event without naming it
    ["is there a hackathon or web development competition today", "Code-A-Site", "tech"],

    // 3. Ask about a specific niche event
    ["I heard there's an archery thing today, where is it?", "Outdoor Archery Practice", "sports"],

    // 4. Ask about a wellness event by description
    ["is there anything where I can do stretching or yoga today", "Mindful Moments: Slow Flow Stretch!", "wellness"],

    // 5. Ask about DnD using gaming language
    ["where can I play dungeons and dragons or tabletop RPGs on campus", "DnD and More! campaign meeting", "games"],

    // 6. Ask about the aquarium trip
    ["is there any off-campus trip or field trip happening today", "Long Island Aquarium Trip", null],

    // 7. Look for the Easter event
    ["anything Easter themed or holiday related happening today", "Easter Scavenger Hunt!", null],

    // 8. Ask for the fashion event
    ["any fashion or cultural shows today", "Fashion Show Readiness", null],

    // 9. Ask about a specific room - SAC 303
    ["what event is in SAC 303 today", 'The Art of Saying "No"', "wellness"],

    // 10. Ask about trivia / quiz events
    ["is there trivia night or quiz bowl today", "Quiz Bowl and Trivia Club GBM", "games"],

    // 11. Ask about running / jogging
    ["I want to go for a group run, any running clubs meeting today", "Stony Brook Running Club", "sports"],

    // 12. Ask about the CPO expert event by topic
    ["any events about consent or sexual health education today", "CPO Expert Series", "wellness"],

    // 13. Ask about badminton or racquet sports
    ["can I play badminton or table tennis somewhere on campus today", "Badminton Club Weekly Meeting", "sports"],

    // 14. Ask about the Abolish Everything event
    ["what's Abolish Everything event about and where is it", "Abolish Everything!", "games"],

    // 15. Ask about tennis specifically
    ["when is tennis practice today and where", "Competitive Team Tennis Practice", "sports"],
  ];

  let totalFound = 0, totalPrimary = 0;
  let totalVerified = 0, totalVerifiedOk = 0;
  let totalRelevant = 0, totalEvents = 0;
  const timings = [];
  const details = [];

  for (let i = 0; i < TESTS.length; i++) {
    const [query, expected, group] = TESTS[i];
    const result = await testQuery(query, i + 1, expected, group);
    if (result.found) totalFound++;
    if (result.isPrimary) totalPrimary++;
    totalVerified += result.verified;
    totalVerifiedOk += result.verifiedOk;
    totalRelevant += result.relevantSimilar;
    totalEvents += result.totalSimilar;
    timings.push(result.elapsed);
    details.push({ query, expected, ...result });
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  KNOWN EVENT RETRIEVAL — FINAL REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Queries tested:            ${TESTS.length}`);
  console.log(`  🎯 Target found:           ${totalFound}/${TESTS.length} (${((totalFound/TESTS.length)*100).toFixed(0)}%)`);
  console.log(`  ⭐ Found as PRIMARY:       ${totalPrimary}/${TESTS.length}`);
  console.log(`  ✅ Live API verification:   ${totalVerifiedOk}/${totalVerified} fields (${totalVerified > 0 ? ((totalVerifiedOk/totalVerified)*100).toFixed(1) : "N/A"}%)`);
  console.log(`  Avg response time:          ${Math.round(timings.reduce((a,b) => a+b, 0) / timings.length)}ms`);
  console.log();
  console.log("  Per-Query Results:");
  for (let i = 0; i < details.length; i++) {
    const d = details[i];
    const icon = d.found ? (d.isPrimary ? "🎯" : "🔵") : "❌";
    console.log(`  ${icon} Q${(i+1).toString().padStart(2)}: ${d.found ? "FOUND" : "MISS "} | ${d.elapsed}ms | "${d.expected}"`);
  }
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
