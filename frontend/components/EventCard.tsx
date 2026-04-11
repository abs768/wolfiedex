/*
  components/EventCard.tsx — a single reusable event card.

  WHAT IS A COMPONENT?
  A component is a function that returns JSX (the HTML-like syntax React uses).
  Once defined, you can use <EventCard event={someEvent} /> anywhere in your app
  and it renders the full card — title, date, location, everything.

  This keeps the card markup in one place. If you want to change how every card
  looks, you change it here once rather than in five different spots.

  WHY "use client"?
  Next.js App Router renders components on the SERVER by default (fast, SEO-
  friendly). But this component has no interactivity, so it technically doesn't
  need "use client". We leave it as a Server Component (no directive) — pure,
  fast HTML from the server.
*/

import type { Event } from "@/data/mockEvents";
/*
  `@/` is an alias for the project root, configured in tsconfig.json.
  It means: "import from wolfiedex/data/mockEvents.ts".
  Without the alias you'd write: "../../data/mockEvents" — error-prone
  once folder nesting gets deep.
*/

/* ─── Category badge colors ──────────────────────────────────────────────── */

/*
  NES.css badge spans accept modifier class names like `is-warning`, `is-error`,
  etc. that apply preset colors. We map each category string to the right one.

  Record<Event["category"], string> means: an object where every key must be
  one of the valid category strings, and every value is a string. TypeScript
  will error if we forget a category — a useful safety net.
*/
const CATEGORY_CLASS: Record<Event["category"], string> = {
  Anime:    "is-warning",  // yellow — energetic, stands out
  Music:    "is-primary",  // blue — cool, matches our palette
  Sports:   "is-success",  // green — active, go-team
  Food:     "is-error",    // red — warm, appetizing
  Gaming:   "is-dark",     // dark grey — sleek, gamer aesthetic
  Academic: "is-default",  // white — clean, neutral
};

/* ─── Props type ─────────────────────────────────────────────────────────── */

/*
  "Props" is short for "properties" — the data you pass into a component,
  like HTML attributes. Here the card accepts exactly one prop: an `event`
  object that must match the `Event` type we defined in mockEvents.ts.
*/
type EventCardProps = {
  event: Event;
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function EventCard({ event }: EventCardProps) {
  /*
    Destructure: instead of writing event.title, event.date, etc. everywhere,
    we pull the fields out into their own variables up front.
  */
  const { title, date, time, location, description, category } = event;

  const badgeClass = CATEGORY_CLASS[category];
  /*
    Look up the NES.css class name for this card's category.
    e.g. if category === "Anime", badgeClass === "is-warning"
  */

  return (
    /*
      `nes-container with-title` draws the chunky pixel border box.
      The <p className="title"> inside it is special — NES.css positions it
      to sit ON TOP of the top border, like a label on a dialog box.
      This is NES.css convention, not something we invented.
    */
    <div
      className="nes-container with-title"
      style={{
        backgroundColor: "#0d2137",   /* slightly lighter than --color-secondary */
        borderColor: "#4a90d9",       /* --color-primary */
        width: "100%",
        maxWidth: "640px",
        marginBottom: "0",            /* gap is handled by the parent list */
      }}
    >
      {/* The title label sits on the top border of the NES container */}
      <p
        className="title"
        style={{ color: "#a8d8ea", fontSize: "0.45rem" }}
      >
        {category}
      </p>

      {/* ── Card body ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

        {/* Event title — largest text in the card */}
        <h2
          style={{
            color: "#4a90d9",
            fontSize: "0.65rem",
            lineHeight: "1.8",
          }}
        >
          {title}
        </h2>

        {/* Date and time on one line, separated by a bullet */}
        <p style={{ color: "#a8d8ea", fontSize: "0.5rem", lineHeight: "1.6" }}>
          {date} &bull; {time}
          {/*
            &bull; is the HTML entity for a bullet point •
            It's a quick visual separator without adding extra elements.
          */}
        </p>

        {/* Location — slightly muted so it reads as secondary info */}
        <p style={{ color: "#7ab8d9", fontSize: "0.5rem", lineHeight: "1.6" }}>
          📍 {location}
        </p>

        {/* Description — smallest text, meant to be read not skimmed */}
        <p
          style={{
            color: "#c8e6f0",
            fontSize: "0.45rem",
            lineHeight: "2",          /* generous line height for pixel font readability */
          }}
        >
          {description}
        </p>

        {/* ── Category badge ──────────────────────────────────────────── */}
        {/*
          NES.css badge structure: outer <span class="nes-badge"> is the
          container that sets up positioning, and the inner <span> carries
          the color class. Both are required for the badge to render correctly.
        */}
        <div style={{ marginTop: "0.25rem" }}>
          <span className="nes-badge">
            <span className={badgeClass}>{category}</span>
          </span>
        </div>

      </div>
    </div>
  );
}
