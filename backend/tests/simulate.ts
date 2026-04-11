/**
 * End-to-end simulation of the ingestion + search pipeline.
 *
 * Mocks Gemini LLM / Embedding calls and MongoDB so you can run this
 * without any credentials and see the exact request/response shapes.
 *
 * Usage:  npx tsx tests/simulate.ts
 */

import type { EventDocument, SearchResponse } from "../src/lib/types";

// ─── Simulated Event Store (replaces MongoDB) ───────────────────────────────

const eventStore: EventDocument[] = [];

// ─── Mock LLM Responses ─────────────────────────────────────────────────────

const MOCK_SEARCH_SUMMARIES: Record<string, string> = {
  "evt-001":
    "Technology workshop covering artificial intelligence machine learning neural networks transformer architectures PyTorch Python hands-on coding session. Beginner-friendly all skill levels welcome. Free pizza food provided. Evening session Friday 5PM-8PM Engineering Building. Earn certificate of completion. Academic enrichment computer science data science deep learning practical deployment skills career development.",
  "evt-002":
    "Career fair job expo recruiting networking professional development. Meet employers recruiters from top tech companies Google Microsoft Amazon. All majors undergraduate graduate welcome. Resume preparation interview practice dress professionally. Weekday morning-to-afternoon Student Union Ballroom. Job internship full-time opportunities career services spring hiring season 2026.",
  "evt-003":
    "Outdoor movie night cinema film screening Interstellar Christopher Nolan science fiction. Social entertainment fun relaxing evening event. Free popcorn blankets provided. Sunset outdoor screen Main Quad Lawn. Hosted Student Activities Board. Weekend evening casual hangout campus life community building stress relief before finals.",
  "evt-004":
    "Yoga mindfulness meditation wellness health fitness stress relief mental health self-care. Guided session certified instructor beginner-friendly no experience needed. Mats provided morning session Recreation Center. Decompress relax before finals exam preparation burnout prevention. Weekend early morning peaceful calm centering physical activity stretching breathing exercises.",
  "evt-005":
    "Hackathon coding competition programming social good nonprofit tech solutions. 24-hour intensive team-based collaborative building. Cash prizes $2000 internship offers. Free meals snacks energy drinks provided. Innovation Hub evening start. Competitive challenging rewarding networking career-boosting. Social impact community service technology for good weekend event.",
};

const MOCK_HYDE_RESPONSES: Record<string, string> = {
  "free food":
    "Campus event offering complimentary meals pizza snacks refreshments to attendees. Student gathering with free food catering provided. Social or academic event where dining is included at no cost. Evening or afternoon event with pizza, popcorn, energy drinks, or catered meals as a perk for attending.",
  "tech events":
    "Technology focused campus event covering programming coding software development AI machine learning. Workshop hackathon or tech talk aimed at computer science students and aspiring developers. Hands-on learning with modern tools frameworks and platforms. Career-boosting technical skills development with industry mentors.",
  "things to do this weekend":
    "Weekend campus events social activities recreation entertainment. Casual relaxing fun gatherings for students looking for Saturday Sunday plans. Outdoor events movie nights sports wellness activities. Community building stress relief hangout opportunities on or near campus.",
  "career help":
    "Professional development career services event. Job fair recruiting networking opportunity to meet employers. Resume building interview prep career coaching. Connecting students with internships full-time positions and industry professionals across all majors.",
  "stress relief before finals":
    "Wellness relaxation self-care event designed to help students decompress before exam period. Yoga meditation mindfulness session or fun social event. Calming stress-reducing activities guided by professionals. Campus wellness initiative supporting student mental health during finals week.",
};

const MOCK_SYNTHESIS: Record<string, string> = {
  "free food":
    "Great news — there are a few events coming up with free food! 🍕 The **AI & Machine Learning Workshop** on April 18th in the Engineering Building serves free pizza while you learn about neural networks and PyTorch. If you're looking for something more intense, the **Hackathon: Build for Social Good** starting May 2nd provides meals, snacks, and energy drinks for the entire 24 hours. Both are awesome ways to eat well and learn something new!",
  "tech events":
    "There are some exciting tech events on campus! 🖥️ The **AI & Machine Learning Workshop** on April 18th is a hands-on session covering neural networks and PyTorch — perfect for all skill levels and you'll get free pizza. For something more competitive, the **Hackathon: Build for Social Good** on May 2-3 is a 24-hour coding marathon with $2,000 in prizes and internship offers. Both are in tech-friendly venues and great for building your skills!",
  "things to do this weekend":
    "Looking for weekend plans? 🎬 This Saturday (April 25th), there's an **Outdoor Movie Night** screening Interstellar on the Main Quad Lawn — blankets and popcorn are provided, and it starts at sunset. If you're an early riser, the **Yoga & Mindfulness Session** on Sunday morning (April 20th) at the Recreation Center is a great way to decompress before the week starts. Both are free and super chill!",
  "career help":
    "If you're thinking about your career, you won't want to miss the **Spring Career Fair 2026** on April 22nd at the Student Union Ballroom! Over 80 companies including Google, Microsoft, and Amazon will be recruiting — just bring your resume and dress professionally. It runs from 10 AM to 4 PM and is open to all majors. This is one of the biggest networking events of the semester!",
  "stress relief before finals":
    "Finals got you stressed? 🧘 The **Yoga & Mindfulness Session** on April 20th is exactly what you need — it's a guided yoga and meditation class at the Recreation Center led by a certified instructor, no experience necessary. If you'd prefer something more laid-back, the **Outdoor Movie Night** on April 25th is a relaxing evening watching Interstellar under the stars with free popcorn. Both are great ways to unwind!",
};

// ─── Mock Embedding: deterministic 768-d vectors ─────────────────────────────

function mockEmbed(text: string): number[] {
  // Simple hash-based deterministic vector for simulation
  const vec = new Array(768).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 768] += text.charCodeAt(i) / 1000;
  }
  // Normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / mag);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Phase 1: Simulate Ingestion ─────────────────────────────────────────────

function simulateIngestion() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  PHASE 1: INGESTION SIMULATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const rawEvents = [
    {
      id: "evt-001",
      title: "AI & Machine Learning Workshop",
      description:
        "Hands-on workshop covering neural networks, transformer architectures, and practical ML deployment with Python and PyTorch. Open to all skill levels. Free pizza provided.",
      date: "2026-04-18T17:00:00Z",
      location: "Engineering Building, Room 302",
      categories: ["Technology", "Workshop", "Academic"],
      benefits: ["Free Food", "Certificate"],
      url: "https://engage.example.edu/event/evt-001",
    },
    {
      id: "evt-002",
      title: "Spring Career Fair 2026",
      description:
        "Meet recruiters from over 80 companies including Google, Microsoft, and Amazon. Bring your resume and dress professionally. All majors welcome.",
      date: "2026-04-22T10:00:00Z",
      location: "Student Union Ballroom",
      categories: ["Career", "Networking"],
      benefits: ["Job Opportunities"],
      url: "https://engage.example.edu/event/evt-002",
    },
    {
      id: "evt-003",
      title: "Outdoor Movie Night: Interstellar",
      description:
        "Enjoy Christopher Nolan's Interstellar on the big outdoor screen. Blankets and popcorn provided. Starts at sunset. Hosted by the Student Activities Board.",
      date: "2026-04-25T20:30:00Z",
      location: "Main Quad Lawn",
      categories: ["Social", "Entertainment"],
      benefits: ["Free Food", "Fun"],
      url: "https://engage.example.edu/event/evt-003",
    },
    {
      id: "evt-004",
      title: "Yoga & Mindfulness Session",
      description:
        "Decompress before finals with a guided yoga and meditation session led by a certified instructor. Mats provided. No experience necessary.",
      date: "2026-04-20T08:00:00Z",
      location: "Recreation Center Studio B",
      categories: ["Health", "Wellness"],
      benefits: ["Stress Relief"],
      url: "https://engage.example.edu/event/evt-004",
    },
    {
      id: "evt-005",
      title: "Hackathon: Build for Social Good",
      description:
        "24-hour hackathon where teams build tech solutions for local nonprofits. Prizes include $2,000 and internship offers. Meals, snacks, and energy drinks provided.",
      date: "2026-05-02T18:00:00Z",
      location: "Innovation Hub, 1st Floor",
      categories: ["Technology", "Competition", "Social Impact"],
      benefits: ["Prizes", "Free Food", "Networking"],
      url: "https://engage.example.edu/event/evt-005",
    },
  ];

  for (const event of rawEvents) {
    const summary = MOCK_SEARCH_SUMMARIES[event.id];
    const embedding = mockEmbed(summary);

    const doc: EventDocument = {
      eventId: event.id,
      title: event.title,
      full_description: event.description,
      date: event.date,
      location: event.location,
      url: event.url,
      search_summary: summary,
      embedding,
      categories: event.categories,
      benefits: event.benefits,
      end_date: event.date,
      image_url: "",
      theme: "",
      organization: "Mock Org",
      institution_id: 126,
      ingested_at: new Date(),
    };

    eventStore.push(doc);

    console.log(`✓ Ingested: ${event.title}`);
    console.log(`  Summary:  ${summary.substring(0, 80)}...`);
    console.log(`  Vector:   [${embedding.slice(0, 4).map((v) => v.toFixed(4)).join(", ")}, ... ] (768-d)\n`);
  }

  console.log(`\n✅ Ingestion complete: ${eventStore.length} events stored.\n`);
}

// ─── Phase 2: Simulate Search Queries ────────────────────────────────────────

function simulateSearch(query: string, currentDate: string) {
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  QUERY: "${query}"`);
  console.log(`  DATE:  ${currentDate}`);
  console.log("───────────────────────────────────────────────────────────\n");

  // ── Request payload (what the frontend sends) ──
  const requestPayload = { query, currentDate };
  console.log("📤 REQUEST  POST /api/search");
  console.log(JSON.stringify(requestPayload, null, 2));
  console.log();

  // ── Step 1: HyDE ──
  const hydeKey = Object.keys(MOCK_HYDE_RESPONSES).find((k) =>
    query.toLowerCase().includes(k)
  )!;
  const hypothetical = MOCK_HYDE_RESPONSES[hydeKey] ?? MOCK_HYDE_RESPONSES["things to do this weekend"];
  console.log("🔮 Step 1 — HyDE Hypothetical Summary:");
  console.log(`   "${hypothetical.substring(0, 120)}..."\n`);

  // ── Step 2: Embed ──
  const queryVector = mockEmbed(hypothetical);
  console.log(
    `🧬 Step 2 — Query Vector: [${queryVector.slice(0, 4).map((v) => v.toFixed(4)).join(", ")}, ...] (768-d)\n`
  );

  // ── Step 3: Vector search (cosine similarity) ──
  const scored = eventStore
    .map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryVector, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  console.log("🔍 Step 3 — Vector Search Results (ranked by cosine similarity):");
  scored.forEach((e, i) => {
    const tag = i < 2 ? "PRIMARY" : "SIMILAR";
    console.log(`   ${i + 1}. [${tag}] ${e.title}  (score: ${e.score.toFixed(4)})`);
  });
  console.log();

  // ── Step 4: Synthesis ──
  const synthKey = Object.keys(MOCK_SYNTHESIS).find((k) =>
    query.toLowerCase().includes(k)
  )!;
  const aiResponse = MOCK_SYNTHESIS[synthKey] ?? MOCK_SYNTHESIS["things to do this weekend"];
  console.log("💬 Step 4 — AI Synthesized Response:");
  console.log(`   ${aiResponse}\n`);

  // ── Step 5: Final JSON response ──
  const primaryEvents = scored.slice(0, 2).map(({ score, embedding, ...rest }) => rest);
  const similarEvents = scored.slice(2, 6).map(({ score, embedding, ...rest }) => rest);

  const response: SearchResponse = {
    ai_response: aiResponse,
    primary_events: primaryEvents.map(e => ({ ...e, date_et: "", end_date_et: "" })) as any,
    similar_events: similarEvents.map(e => ({ ...e, date_et: "", end_date_et: "" })) as any,
  };

  console.log("📥 RESPONSE  200 OK");
  console.log(
    JSON.stringify(
      {
        ai_response: response.ai_response,
        primary_events: response.primary_events.map((e) => ({
          eventId: e.eventId,
          title: e.title,
          date: e.date,
          location: e.location,
          url: e.url,
          categories: e.categories,
          benefits: e.benefits,
        })),
        similar_events: response.similar_events.map((e) => ({
          eventId: e.eventId,
          title: e.title,
          date: e.date,
          location: e.location,
        })),
      },
      null,
      2
    )
  );
  console.log("\n");
}

// ─── Run ─────────────────────────────────────────────────────────────────────

simulateIngestion();

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  PHASE 2: SEARCH SIMULATION — 5 SAMPLE QUERIES");
console.log("═══════════════════════════════════════════════════════════\n");

const SAMPLE_QUERIES = [
  { query: "any events with free food?", currentDate: "2026-04-15" },
  { query: "what tech events are happening on campus?", currentDate: "2026-04-15" },
  { query: "things to do this weekend", currentDate: "2026-04-18" },
  { query: "I need career help and job opportunities", currentDate: "2026-04-15" },
  { query: "stress relief before finals", currentDate: "2026-04-17" },
];

for (const { query, currentDate } of SAMPLE_QUERIES) {
  simulateSearch(query, currentDate);
}
