"use client";

import { useState, useEffect, useRef } from "react";

const placeholders = [
  "Search for events...",
  "Anime events this week?",
  "Events after 5PM?",
  "Free food on campus?",
  "Club meetings today?",
];

type QueryInputProps = {
  onSubmit: (query: string) => void;
};

export default function QueryInput({ onSubmit }: QueryInputProps) {
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState(false);

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [opacity, setOpacity] = useState(1);
  const indexRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const current = placeholders[indexRef.current];

    if (displayText.length < current.length) {
      timeout = setTimeout(() => {
        setDisplayText(current.slice(0, displayText.length + 1));
      }, 60);
    } else {
      timeout = setTimeout(() => {
        setOpacity(0);
        setTimeout(() => {
          indexRef.current = (indexRef.current + 1) % placeholders.length;
          setPlaceholderIndex(indexRef.current);
          setDisplayText("");
          setOpacity(1);
        }, 400);
      }, 2000);
    }

    return () => clearTimeout(timeout);
  }, [displayText, placeholderIndex]);

  function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setQuery("");
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "480px",
        aspectRatio: "1048 / 356",
        backgroundImage: "url(/search-box.png)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        cursor: "text",
        filter: hovered ? "drop-shadow(0 0 8px rgba(74, 144, 217, 0.75))" : "none",
        transition: "filter 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "5%",
          right: "18%",
          top: "50%",
          transform: "translateY(-50%)",
          height: "70%",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          onFocus={() => setDisplayText("")}
          onBlur={() => {}}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
            fontSize: "13px",
            color: "#000000",
            caretColor: "#000000",
            paddingLeft: "20px",
            paddingTop: "6px",
            width: "100%",
            zIndex: 2,
          }}
        />
        {!query && (
          <span
            style={{
              fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
              fontSize: "13px",
              color: "#000000",
              opacity: opacity,
              transition: "opacity 0.4s ease",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              display: "block",
              textAlign: "left",
              paddingLeft: "20px",
            }}
          >
            {displayText}
          </span>
        )}
      </div>

      <button
        onClick={() => handleSubmit()}
        style={{
          position: "absolute",
          right: "0",
          top: "0",
          width: "18%",
          height: "100%",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          zIndex: 10,
        }}
      />
    </div>
  );
}
