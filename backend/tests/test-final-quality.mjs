/**
 * Final quality test — focuses on the previously weak areas + comprehensive coverage.
 * Now with all 6 events sent to synthesis for better reasoning.
 *
 * Usage: node tests/test-final-quality.mjs
 */

const API_URL = "http://localhost:3001/api/search";
const CURRENT_DATE = "Friday, April 10, 2026";

const TESTS = [
  // Previously weak — perk queries
  "where can I get free food on campus today",
  "any events giving away free stuff or freebies today?",

  // Previously weak — location-specific
  "what's happening at the Union Ballroom today",

  // Direct yes/no
  "is there a hackathon today?",

  // Honest no-match
  "are there any yoga classes today?",

  // Where/when
  "where is the archery practice?",
  "when does the meditation event start?",

  // Emotional
  "I just bombed my midterm and feel terrible, anything to cheer me up",
  "I'm new on campus and don't know anyone, what can I go to",

  // Decision / comparison
  "I have free time from 3 to 5pm, what's the best thing I could go to?",
  "should I go to the escape room or the scavenger hunt?",

  // Detailed
  "tell me more about the CPO consent event, what happens there",
  "what organization is hosting campus beautification day?",

  // Edge cases
  "are there any concerts or live music today",
  "what's happening tomorrow or this weekend",
];

async function runTest(query, num) {
  const sep = "━".repeat(80);
  console.log(`\n${sep}`);
  console.log(`  Q${num}: "${query}"`);
  console.log(`${sep}\n`);

  const start = Date.now();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, currentDate: CURRENT_DATE }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();

  // Word-wrapped AI response
  console.log(`  💬 AI RESPONSE (${elapsed}ms):\n`);
  const words = data.ai_response.split(" ");
  let line = "     ";
  for (const word of words) {
    if (line.length + word.length > 85) {
      console.log(line);
      line = "     " + word + " ";
    } else {
      line += word + " ";
    }
  }
  if (line.trim()) console.log(line);

  console.log(`\n  📋 Events returned:`);
  for (const e of (data.primary_events || [])) {
    const perks = (e.benefits||[]).length ? ` | 🎁 ${e.benefits.join(", ")}` : "";
    const cats = (e.categories||[]).length ? ` | 🏷️ ${e.categories.join(", ")}` : "";
    console.log(`     🟢 ${e.title} | ${e.date_et} → ${e.end_date_et} | 📍 ${e.location}${perks}${cats}`);
  }
  for (const e of (data.similar_events || [])) {
    const perks = (e.benefits||[]).length ? ` | 🎁 ${e.benefits.join(", ")}` : "";
    console.log(`     🔵 ${e.title} | ${e.date_et} | 📍 ${e.location}${perks}`);
  }

  return elapsed;
}

async function main() {
  console.log("═".repeat(80));
  console.log("  SB ENGAGED — Final Response Quality Test (All 6 Events → Synthesis)");
  console.log("═".repeat(80));

  const timings = [];
  for (let i = 0; i < TESTS.length; i++) {
    timings.push(await runTest(TESTS[i], i + 1));
  }

  console.log(`\n\n${"═".repeat(80)}`);
  console.log(`  SUMMARY: ${TESTS.length} queries | Avg ${Math.round(timings.reduce((a,b)=>a+b,0)/timings.length)}ms | Fastest ${Math.min(...timings)}ms | Slowest ${Math.max(...timings)}ms`);
  console.log("═".repeat(80));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
