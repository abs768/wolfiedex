/**
 * Stress test with complex, ambiguous, and edge-case queries
 * to push the HyDE RAG pipeline to its limits.
 *
 * Usage: node tests/test-complex.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";
const CURRENT_DATE = "Friday, April 10, 2026";

async function fetchLiveEvent(name) {
  const params = new URLSearchParams({
    endsAfter: "2026-04-10T00:00:00Z", query: name.substring(0, 40),
    status: "Approved", take: "5",
  });
  const res = await fetch(`${ENGAGE_API}?${params}`);
  const data = await res.json();
  return data.value || [];
}

async function testQuery(query, queryNum) {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  TEST ${queryNum}: "${query}"`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  const start = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, currentDate: CURRENT_DATE }),
  });
  const elapsed = Date.now() - start;

  if (!res.ok) {
    const err = await res.text();
    console.log(`   ❌ HTTP ${res.status}: ${err}`);
    return { checked: 0, matched: 0, elapsed, pass: false };
  }

  const data = await res.json();
  console.log(`   ⏱️  ${elapsed}ms\n`);

  // AI Response
  console.log(`💬 AI Response:`);
  console.log(`   "${data.ai_response}"\n`);

  // Sanity checks
  let issues = [];

  // Check 1: AI response should not be empty
  if (!data.ai_response || data.ai_response.length < 20) {
    issues.push("AI response too short or empty");
  }

  // Check 2: Should return primary events
  if (!data.primary_events?.length) {
    issues.push("No primary events returned");
  }

  // Check 3: All events should have required fields
  const allEvents = [...(data.primary_events || []), ...(data.similar_events || [])];
  for (const e of allEvents) {
    if (!e.title) issues.push(`Event missing title`);
    if (!e.date_et) issues.push(`Event "${e.title}" missing date_et`);
    if (!e.location) issues.push(`Event "${e.title}" missing location`);
    if (!e.url) issues.push(`Event "${e.title}" missing url`);
  }

  // Check 4: Cross-verify against live API
  let checked = 0, matched = 0;

  console.log(`🟢 Primary Events (${data.primary_events?.length || 0}):`);
  for (const e of (data.primary_events || [])) {
    console.log(`   • ${e.title}`);
    console.log(`     📅 ${e.date_et} → ${e.end_date_et}`);
    console.log(`     📍 ${e.location} | 🏢 ${e.organization}`);
    if (e.benefits?.length) console.log(`     🎁 ${e.benefits.join(", ")}`);
    if (e.categories?.length) console.log(`     🏷️  ${e.categories.join(", ")}`);

    const liveResults = await fetchLiveEvent(e.title);
    const live = liveResults.find(l => l.id.toString() === e.eventId)
      || liveResults.find(l => l.name === e.title);
    if (live) {
      const titleOk = e.title === live.name;
      const locOk = e.location === live.location;
      checked += 2;
      matched += (titleOk ? 1 : 0) + (locOk ? 1 : 0);
      console.log(`     ✅ Verified: Title ${titleOk ? "✓" : "✗"} | Location ${locOk ? "✓" : "✗"}`);
    } else {
      console.log(`     ⚠️  Not found in live API`);
    }
    console.log();
  }

  console.log(`🔵 Similar Events (${data.similar_events?.length || 0}):`);
  for (const e of (data.similar_events || [])) {
    console.log(`   • ${e.title} | ${e.date_et} | 📍 ${e.location}`);
    const liveResults = await fetchLiveEvent(e.title);
    const live = liveResults.find(l => l.id.toString() === e.eventId)
      || liveResults.find(l => l.name === e.title);
    if (live) {
      const titleOk = e.title === live.name;
      const locOk = e.location === live.location;
      checked += 2;
      matched += (titleOk ? 1 : 0) + (locOk ? 1 : 0);
      console.log(`     ✅ Title ${titleOk ? "✓" : "✗"} | Location ${locOk ? "✓" : "✗"}`);
    }
  }

  if (issues.length) {
    console.log(`\n   ⚠️  Issues: ${issues.join("; ")}`);
  }

  console.log();
  return { checked, matched, elapsed, issues };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SB ENGAGED — Complex Query Stress Test");
  console.log("  Testing edge cases, ambiguity, slang, and multi-intent");
  console.log("═══════════════════════════════════════════════════════════════");

  const QUERIES = [
    // 1. Slang / informal language
    "yo is there anything lit happening rn on campus",

    // 2. Multi-intent (food + social + time constraint)
    "I'm starving and bored, what's going on near the student union before 5pm with free snacks",

    // 3. Negation / exclusion
    "anything fun that's NOT academic or sports related",

    // 4. Vague emotional query
    "I'm feeling really lonely and anxious, is there something chill I can go to",

    // 5. Very specific (room number + time)
    "what's happening in SAC today around 2 or 3pm",

    // 6. Hypothetical / conditional
    "if I finish class at 3:30, what can I still make it to today",

    // 7. Category that may not exist directly
    "any Greek life or fraternity sorority events today",

    // 8. Misspelled / typo query
    "meditatoin or yoag events on campis",

    // 9. Multi-day planning
    "what should I do this entire weekend on campus",

    // 10. Comparison query
    "which events have the most free stuff or giveaways today",
  ];

  let totalChecked = 0, totalMatched = 0;
  const timings = [];
  const results = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const result = await testQuery(QUERIES[i], i + 1);
    totalChecked += result.checked;
    totalMatched += result.matched;
    if (result.elapsed) timings.push(result.elapsed);
    results.push({ query: QUERIES[i], ...result });
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  STRESS TEST FINAL REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Complex queries tested: ${QUERIES.length}`);
  console.log(`  Field checks:           ${totalChecked}`);
  console.log(`  ✅ Verified correct:    ${totalMatched}`);
  console.log(`  Accuracy:               ${totalChecked > 0 ? ((totalMatched / totalChecked) * 100).toFixed(1) : "N/A"}%`);
  console.log(`  Avg response time:      ${Math.round(timings.reduce((a,b) => a+b, 0) / timings.length)}ms`);
  console.log(`  Fastest:                ${Math.min(...timings)}ms`);
  console.log(`  Slowest:                ${Math.max(...timings)}ms`);
  console.log();

  // Per-query summary
  console.log("  Per-Query Breakdown:");
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const acc = r.checked > 0 ? ((r.matched / r.checked) * 100).toFixed(0) : "N/A";
    const status = (r.issues?.length) ? "⚠️" : "✅";
    console.log(`  ${status} Q${i+1}: ${acc}% | ${r.elapsed}ms | "${QUERIES[i].substring(0, 50)}..."`);
  }
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
