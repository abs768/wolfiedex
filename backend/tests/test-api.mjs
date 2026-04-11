/**
 * Tests the LIVE Next.js API endpoints (POST /api/search)
 * with 5 different queries, then cross-checks results against the Engage API.
 *
 * Usage: node tests/test-api.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const ENGAGE_API = "https://stonybrook.campuslabs.com/engage/api/discovery/event/search";
const CURRENT_DATE = "Friday, April 10, 2026";

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&hellip;/g, "…").replace(/&rsquo;/g, "'").replace(/&#39;/g, "'").trim();
}

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

  console.log(`📤 POST /api/search`);
  console.log(`   Body: { query: "${query}", currentDate: "${CURRENT_DATE}" }\n`);

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
    return { checked: 0, matched: 0 };
  }

  const data = await res.json();
  console.log(`   ⏱️  Response time: ${elapsed}ms`);
  console.log(`   📦 Status: ${res.status} OK\n`);

  // AI Response
  console.log(`💬 AI Response:`);
  console.log(`   "${data.ai_response}"\n`);

  // Primary Events
  let checked = 0, matched = 0;

  console.log(`🟢 Primary Events (${data.primary_events?.length || 0}):`);
  for (const e of (data.primary_events || [])) {
    console.log(`   • ${e.title}`);
    console.log(`     📅 ${e.date_et} → ${e.end_date_et}`);
    console.log(`     📍 ${e.location}`);
    console.log(`     🏢 ${e.organization}`);
    if (e.benefits?.length) console.log(`     🎁 ${e.benefits.join(", ")}`);
    if (e.categories?.length) console.log(`     🏷️  ${e.categories.join(", ")}`);
    console.log(`     🔗 ${e.url}`);

    // Cross-check against live API
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
      console.log(`     ⚠️  Could not find in live API for verification`);
    }
    console.log();
  }

  // Similar Events
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
      console.log(`     ✅ Verified: Title ${titleOk ? "✓" : "✗"} | Location ${locOk ? "✓" : "✗"}`);
    }
  }

  console.log();
  return { checked, matched, elapsed };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SB ENGAGED — Live API Endpoint Test");
  console.log("  Testing POST /api/search on http://localhost:3000");
  console.log("═══════════════════════════════════════════════════════════════");

  const QUERIES = [
    "any events with free food today?",
    "wellness or meditation events",
    "coding or tech events happening this week",
    "fun things to do on campus tonight",
    "I need to de-stress before finals",
  ];

  let totalChecked = 0, totalMatched = 0;
  const timings = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const result = await testQuery(QUERIES[i], i + 1);
    totalChecked += result.checked;
    totalMatched += result.matched;
    if (result.elapsed) timings.push(result.elapsed);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  FINAL REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Queries tested:       ${QUERIES.length}`);
  console.log(`  Field checks:         ${totalChecked}`);
  console.log(`  ✅ Verified correct:  ${totalMatched}`);
  console.log(`  Accuracy:             ${totalChecked > 0 ? ((totalMatched / totalChecked) * 100).toFixed(1) : 0}%`);
  console.log(`  Avg response time:    ${Math.round(timings.reduce((a,b) => a+b, 0) / timings.length)}ms`);
  console.log(`  Fastest:              ${Math.min(...timings)}ms`);
  console.log(`  Slowest:              ${Math.max(...timings)}ms`);
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
