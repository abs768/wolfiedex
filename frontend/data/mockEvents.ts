/*
  data/mockEvents.ts — the fake event data for Phase 2.

  WHY A SEPARATE FILE?
  Keeping data separate from UI components is a good habit. Later, when we
  replace this with real API data, we only touch one place — not every
  component that uses the data.

  WHY TypeScript types?
  The `Event` type below acts as a contract. If you accidentally spell
  "categori" instead of "category", TypeScript will underline it in red
  immediately — before you even run the app. This catches bugs early.
*/

/* ─── Type definition ────────────────────────────────────────────────────── */

/*
  `export` means other files can import this type.
  Each property name is followed by its type after the colon.
  The `|` symbol means "or" — category can be any one of these exact strings.
*/
export type Event = {
  id: string;
  title: string;
  date: string;        // human-readable, e.g. "Friday, April 11"
  time: string;        // human-readable, e.g. "7:00 PM"
  location: string;
  description: string;
  category: "Anime" | "Music" | "Sports" | "Food" | "Gaming" | "Academic";
};

/* ─── Mock data ──────────────────────────────────────────────────────────── */

/*
  `as const` tells TypeScript to treat this array as read-only and to infer
  the most specific types possible (e.g. "Anime" instead of just `string`).
  This means the category values are checked against the union type above.
*/
export const mockEvents: Event[] = [
  {
    id: "1",
    title: "Anime Movie Night: Spirited Away",
    date: "Friday, April 11",
    time: "7:00 PM",
    location: "SAC Auditorium",
    description:
      "Join SBU Anime Club for a free screening of Studio Ghibli's Spirited Away. Popcorn provided. No RSVP needed — first come, first served.",
    category: "Anime",
  },
  {
    id: "2",
    title: "Spring Seawolves Concert",
    date: "Saturday, April 12",
    time: "6:00 PM",
    location: "Staller Center Main Stage",
    description:
      "The SBU Orchestra performs a spring concert featuring works by Beethoven and Debussy. Free admission for students with valid SBU ID.",
    category: "Music",
  },
  {
    id: "3",
    title: "Intramural Basketball Tournament",
    date: "Sunday, April 13",
    time: "12:00 PM",
    location: "Island Federal Credit Union Arena",
    description:
      "Cheer on your friends in the semester finals of the SBU intramural basketball league. All skill levels competed — come support your team.",
    category: "Sports",
  },
  {
    id: "4",
    title: "International Food Festival",
    date: "Wednesday, April 16",
    time: "11:00 AM",
    location: "Union Square (Front of Student Union)",
    description:
      "Student cultural clubs bring dishes from around the world. Sample food from 20+ countries and chat with the clubs that made them.",
    category: "Food",
  },
  {
    id: "5",
    title: "Smash Bros Open Tournament",
    date: "Thursday, April 17",
    time: "5:00 PM",
    location: "Javits Lecture Hall Room 110",
    description:
      "SBU Gaming Club hosts a Super Smash Bros Ultimate bracket. Sign up at the door. Prizes for top 3 finishers. All welcome.",
    category: "Gaming",
  },
];
