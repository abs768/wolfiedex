# WolfieDex

**WolfieDex** is an AI-powered event discovery platform for Stony Brook University that helps students find relevant campus events using natural-language search.

Instead of relying on exact keyword matches or rigid filters, WolfieDex interprets student intent, retrieves semantically relevant events from SB Engaged, and generates grounded responses using live event data.

- **Live App:** https://wolfiedex.vercel.app
- **Demo Video:** https://www.youtube.com/watch?v=tCpCjai6fgw

> If the live deployment is unavailable, the demo video shows the deployed product in action.

---

## Problem

Campus event platforms contain plenty of useful information, but students still struggle to find events that match what they actually want.

The issue is not missing data. The issue is retrieval mismatch.

Students search by intent, mood, and outcome:

```text
Where can I get free food?
Anything Japanese-themed happening this week?
Are there any chill coding meetups tonight?
```

But event listings are usually written in formal or administrative language. A listing might say “complimentary catering” instead of “free food,” or describe a casual meetup using official club language.

WolfieDex solves this by adding an intelligent retrieval layer over Stony Brook’s existing event data.

---

## What WolfieDex Does

WolfieDex allows students to ask natural-language questions about campus events and receive:

- A direct answer to their query
- The strongest matching events
- Similar events that may also fit their intent
- Grounded responses based only on retrieved event data

The goal is not to make event search conversational for novelty. The goal is to make event discovery work the way students naturally think.

---

## Example Queries

```text
Are there any chill coding meetups tonight?
Anything Japanese-themed happening this week?
Where can I get free food on campus?
Are there networking events for CS students?
What events are happening this weekend?
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, Tailwind CSS |
| Deployment | Vercel, DigitalOcean App Platform |
| Backend | Next.js Serverless APIs, Python scraper |
| Database | MongoDB Atlas |
| Vector Search | MongoDB Atlas Vector Search |
| LLM | Groq API with Llama 3 |
| Embeddings | Hugging Face Inference API, all-MiniLM-L6-v2 |
| Data Source | SB Engaged event listings |

---

## System Architecture

WolfieDex is built around two main pipelines:

1. **Event ingestion and indexing**
2. **Query understanding and retrieval**

```text
SB Engaged
   ↓
Python scraper / background worker
   ↓
Event cleaning + search-oriented summary generation
   ↓
Embedding generation
   ↓
MongoDB Atlas + Vector Search
   ↓
Natural-language query
   ↓
HyDE query expansion
   ↓
Vector retrieval
   ↓
Grounded LLM response
   ↓
Answer + matching events
```

---

## Event Ingestion and Indexing

A background worker continuously pulls live event data from SB Engaged.

One of the most important design decisions was to avoid embedding raw event descriptions directly.

Event pages are written for display, not retrieval. They often contain noisy formatting, inconsistent wording, and promotional language that weakens semantic search.

WolfieDex stores:

- Original event data for display
- Search-optimized summaries for retrieval
- Vector embeddings for semantic matching

This separation between display data and search data is one of the core ideas behind the project.

---

## Query Pipeline

At query time, WolfieDex uses **HyDE**, or Hypothetical Document Embeddings.

Instead of embedding the user’s short query directly, the system first generates the kind of event description that would ideally satisfy the query. That hypothetical description is embedded and used for vector search.

This helps bridge the gap between informal student phrasing and formal event descriptions.

```text
User query
   ↓
HyDE query expansion
   ↓
Embedding generation
   ↓
MongoDB Atlas Vector Search
   ↓
Top event retrieval
   ↓
Grounded response generation
   ↓
Final answer + matching events
```

---

## Retrieval Strategy

WolfieDex uses cosine similarity over vector embeddings to retrieve events whose search summaries are closest to the user’s intent.

The harder problem was not the vector math itself. The harder problem was designing the right representation to embed.

Raw event descriptions were noisy and inconsistent, so WolfieDex uses multi-representation indexing:

- Raw event description for display
- Search-oriented event summary for embedding
- Retrieved event records for grounded generation

This improves retrieval quality for vague, informal, or intent-based student queries.

---

## Key Features

- Natural-language event search
- Live ingestion from SB Engaged
- Search-optimized event representation
- HyDE-based query expansion
- MongoDB Atlas Vector Search
- Grounded answer synthesis
- Similar event recommendations
- Deployed frontend and backend architecture
- Retro-styled user interface
- Demo video fallback for reviewers if the live app is unavailable

---

## Challenges

### Retrieval Quality

The hardest challenge was matching informal student language with formal event listings.

Students search by mood, benefit, time, and context. Event listings are often written in promotional or administrative language.

WolfieDex addresses this through:

- Multi-representation indexing
- HyDE-based query expansion
- Vector search over search-optimized summaries

### Latency

The query path includes multiple dependent steps:

```text
Query expansion → embedding generation → vector retrieval → response synthesis
```

Even when each component is fast, total delay can compound quickly.

To keep the app responsive, the system uses lightweight models and separates frontend serving from heavier backend ingestion workloads.

### Deployment

The frontend and ingestion workloads had different runtime needs.

The UI is deployed on Vercel, while heavier backend processing runs separately on DigitalOcean App Platform. This keeps the frontend responsive while allowing backend jobs to run in an environment better suited for scraping and ingestion.

---

## What I Learned

WolfieDex reinforced one major lesson:

**Useful AI systems depend on good representations.**

Key takeaways:

- The best format for display is often not the best format for search.
- Retrieval quality depends heavily on preprocessing and indexing design.
- Vague human queries need structure before they can be matched effectively.
- Generation is more reliable when grounded in retrieved evidence.
- Deployment decisions are part of the product, not just implementation details.
- Making a system sound intelligent is easy; making it retrieve the right thing under messy real-world language is much harder.

---

## Future Work

Planned improvements:

- User accounts
- Personalized event recommendations
- Preference learning based on saved or clicked events
- Ranking model using user context
- SMS or email notifications for relevant events
- Retrieval evaluation using labeled query-event pairs
- Latency and relevance benchmarking
- Admin dashboard for ingestion health

---

## Why This Project Matters

WolfieDex is not just a chatbot over event data.

It is a retrieval system designed around a real discovery problem: students know what they want, but they do not always know the exact words event organizers used.

The project focuses on the part that actually matters: retrieving the right event under messy, real-world language.
