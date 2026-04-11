"use client";
/*
  components/ChatWindow.tsx — the scrollable conversation history.

  WHY "use client"?
  Two reasons:
  1. We use `useEffect` to auto-scroll when new messages arrive. useEffect
     runs after the browser has painted the screen — it doesn't exist on
     the server.
  2. We use `useRef` to get a direct reference to a DOM element (the invisible
     div at the bottom of the message list) so we can scroll to it.

  Both hooks require the browser environment → "use client" is required.
*/

import { useEffect, useRef } from "react";
import EventCard from "@/components/EventCard";
import type { Event } from "@/data/mockEvents";

/* ─── Message type ───────────────────────────────────────────────────────── */

/*
  This type describes a single chat message. We export it so page.tsx can
  use the same definition — one source of truth, no duplication.

  `role: "user" | "bot"` — who sent the message.
  `text` — the text bubble content.
  `events?` — the `?` means optional. Only bot messages that found results
              carry an events array. User messages and "no results" bot
              messages don't have one.
*/
export type Message = {
  role: "user" | "bot";
  text: string;
  events?: Event[];
};

/* ─── Props ──────────────────────────────────────────────────────────────── */

type ChatWindowProps = {
  messages: Message[];
  /*
    The parent (page.tsx) owns the messages array and passes it down as a prop.
    ChatWindow only DISPLAYS messages — it never adds or removes them.
    This is called "lifting state up": the state lives at the highest level
    that needs it, and children receive it as read-only props.
  */
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function ChatWindow({ messages }: ChatWindowProps) {
  /*
    `useRef` gives us a stable reference to a real DOM element.
    Think of it like `document.getElementById()` but the React way.
    We'll attach this ref to a tiny invisible <div> at the bottom of
    the message list so we can programmatically scroll to it.
  */
  const bottomRef = useRef<HTMLDivElement>(null);

  /*
    `useEffect` runs AFTER React has updated the DOM and the browser has
    painted. The second argument `[messages]` is the dependency array —
    this effect re-runs every time `messages` changes (i.e. every time
    a new message is added).

    `scrollIntoView({ behavior: "smooth" })` smoothly scrolls the page
    until the referenced element is visible — giving us auto-scroll to
    the latest message.
  */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    /*
      The `?.` is optional chaining — if bottomRef.current is null
      (element not yet in the DOM), we do nothing instead of crashing.
    */
  }, [messages]);

  /* ── Empty state ────────────────────────────────────────────────────── */

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <p
          style={{
            color: "#1a3a5c",
            fontSize: "0.5rem",
            textAlign: "center",
            lineHeight: "2.5",
          }}
        >
          Type a question below to find events!{"\n"}
          Try: &quot;anime&quot;, &quot;food&quot;, &quot;friday&quot;
        </p>
      </div>
    );
  }

  /* ── Message list ───────────────────────────────────────────────────── */

  return (
    /*
      `flex: 1` tells this div to expand and fill all the vertical space
      between the header and the input bar. `overflow-y: auto` enables
      vertical scrolling when the content is taller than the container.
      Together these two properties create the scrollable chat area.
    */
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {messages.map((message, index) => (
        /*
          Using the array index as a key is acceptable here because messages
          are only ever appended (never reordered or deleted), so the index
          is stable for each message's lifetime.
        */
        <div key={index}>

          {message.role === "user" ? (
            /* ── User bubble (right side) ─────────────────────────────── */
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div className="chat-bubble-user">
                <p style={{ color: "#e0f0ff", fontSize: "0.5rem", lineHeight: "2" }}>
                  {message.text}
                </p>
              </div>
            </div>

          ) : (
            /* ── Bot bubble (left side) ───────────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1rem" }}>
              <div className="chat-bubble-bot">
                <p style={{ color: "#a8d8ea", fontSize: "0.5rem", lineHeight: "2" }}>
                  {message.text}
                </p>
              </div>

              {/*
                If this bot message includes matching events, render each one
                as an EventCard below the text bubble.

                `message.events?.length > 0` — the `?.` means: only check
                `.length` if `events` is not undefined. Safe shorthand.
              */}
              {message.events && message.events.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                    width: "100%",
                  }}
                >
                  {message.events.map((event) => (
                    <li key={event.id}>
                      <EventCard event={event} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      ))}

      {/*
        An invisible zero-height div at the very end of the message list.
        `useEffect` scrolls to this element after every new message, which
        means the latest content is always in view.
      */}
      <div ref={bottomRef} />
    </div>
  );
}
