// ═══════════════════════════════════════════════════════════════════════════════
// SB Engaged — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Anthology Engage API Response Types ─────────────────────────────────────
// These mirror the real JSON shape from:
// GET https://stonybrook.campuslabs.com/engage/api/discovery/event/search

/** OData-style envelope returned by the Engage discovery API */
export interface EngageSearchResponse {
  "@odata.count": number;
  "@search.coverage": null;
  "@search.facets": {
    CategoryIds: EngageFacet[];
    BenefitNames: EngageFacet[];
    Theme: EngageFacet[];
    BranchId: EngageFacet[];
  };
  value: EngageEvent[];
}

export interface EngageFacet {
  type: number;
  from: null;
  to: null;
  value: string;
  count: number;
}

/** A single event object from the Engage discovery API */
export interface EngageEvent {
  id: string;
  institutionId: number;
  organizationId: number;
  organizationIds: number[];
  branchId: number;
  branchIds: number[];
  organizationName: string;
  organizationProfilePicture: string;
  organizationNames: string[];
  name: string;
  description: string;            // ⚠️ HTML-formatted, must be stripped
  location: string;
  startsOn: string;               // ISO 8601 UTC
  endsOn: string;                 // ISO 8601 UTC
  imagePath: string;
  theme: string;
  categoryIds: number[];
  categoryNames: string[];
  benefitNames: string[];
  visibility: string;
  status: string;
  latitude: string;
  longitude: string;
  recScore: number | null;
  rsvpTotal: number;
  "@search.score": number;
}

// ─── MongoDB Document Schema (Multi-Representation Indexing) ─────────────────
//
// DISPLAY LAYER: title, full_description, date, location, url, image_url
//   → Rendered directly on the frontend event cards.
//
// SEARCH LAYER: search_summary + embedding
//   → search_summary is a dense, LLM-generated keyword paragraph.
//   → embedding is the vector of search_summary ONLY (not the raw description).
//   → This separation is the core of Multi-Representation Indexing:
//     we search against an optimized representation, but display the original.

export interface EventDocument {
  // ── Display layer ──
  eventId: string;
  title: string;
  full_description: string;       // Plain text (HTML stripped at ingestion)
  date: string;                   // ISO 8601 UTC start time
  end_date: string;               // ISO 8601 UTC end time
  location: string;
  url: string;                    // Link to event on SB Engaged portal
  image_url: string;              // CDN link for event image

  // ── Search layer ──
  search_summary: string;         // Groq-generated dense keyword summary
  embedding: number[];            // 384-d vector from all-MiniLM-L6-v2

  // ── Metadata ──
  categories: string[];
  benefits: string[];
  theme: string;
  organization: string;
  institution_id: number;
  ingested_at: Date;
}

// ─── API Response Types ──────────────────────────────────────────────────────

/** Shape returned by POST /api/search */
export interface SearchResponse {
  ai_response: string;
  primary_events: (EventDocument & { date_et: string; end_date_et: string })[];
  similar_events: (EventDocument & { date_et: string; end_date_et: string })[];
}
