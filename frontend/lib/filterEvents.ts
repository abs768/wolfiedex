/*
  lib/filterEvents.ts — the search/filter brain of WolfieDex.

  WHY A SEPARATE `lib/` FOLDER?
  `lib/` is the conventional place for pure logic — functions that have
  no UI, no React, no JSX. They just take inputs and return outputs.
  This makes them easy to test later and easy to swap out (in Phase 4
  we'll replace the body of this function with a real API call, but
  nothing else in the codebase needs to change).

  WHY NOT PUT THIS IN A COMPONENT?
  Components should only contain rendering logic. Mixing search logic
  into a component makes it harder to change either one independently.
*/

import type { Event } from "@/data/mockEvents";

/*
  filterEvents — takes what the user typed and the full list of events,
  returns only the events that are relevant to the query.

  HOW THE MATCHING WORKS:
  1. Split the query into individual words (so "anime friday" becomes
     ["anime", "friday"]).
  2. For each event, check whether ANY of those words appears inside
     the event's title, description, or category.
  3. The check is case-insensitive: "Anime", "ANIME", and "anime" all match.
  4. If the query is empty (user hit ASK with a blank box), return all events.

  This is intentionally simple — a real Phase 4 version would use
  an LLM to understand meaning, not just keyword matching.
*/
export function filterEvents(query: string, events: Event[]): Event[] {
  const trimmed = query.trim();

  // If nothing was typed, return everything so the user sees all events.
  if (!trimmed) return events;

  /*
    Split on whitespace. "what anime events" → ["what", "anime", "events"]
    .toLowerCase() so we compare apples to apples.
  */
  const words = trimmed.toLowerCase().split(/\s+/);

  return events.filter((event) => {
    /*
      Build one big searchable string from the fields we care about.
      Joining with a space means a word won't accidentally span two fields
      (e.g. the end of the title + start of the description).
    */
    const searchable = [
      event.title,
      event.description,
      event.category,
      event.location,
    ]
      .join(" ")
      .toLowerCase();

    /*
      `Array.some()` returns true if AT LEAST ONE word matches.
      So "anime music" matches any event that contains "anime" OR "music".
      This is more forgiving than requiring ALL words to match.
    */
    return words.some((word) => searchable.includes(word));
  });
}
