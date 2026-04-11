"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import QueryInput from "@/components/QueryInput";
import EventCard from "@/components/EventCard";

interface PrimaryEvent {
  title: string
  date_et: string
  end_date_et: string
  location: string
  organization: string
  benefits: string[]
  image_url: string
  url: string
}

interface SimilarEvent {
  title: string
  date_et: string
  end_date_et: string
  location: string
  benefits: string[]
}

/* ─── Pixel heart SVG ────────────────────────────────────────────────────── */

function PixelHeart() {
  return (
    <svg
      width="18" height="16" viewBox="0 0 18 16"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: "pixelated", display: "inline-block", verticalAlign: "middle", margin: "0 4px" }}
    >
      <rect x="2"  y="0"  width="2"  height="2" fill="#ff0000"/>
      <rect x="4"  y="0"  width="2"  height="2" fill="#ff0000"/>
      <rect x="10" y="0"  width="2"  height="2" fill="#ff0000"/>
      <rect x="12" y="0"  width="2"  height="2" fill="#ff0000"/>
      <rect x="0"  y="2"  width="2"  height="2" fill="#ff0000"/>
      <rect x="2"  y="2"  width="6"  height="2" fill="#ff0000"/>
      <rect x="8"  y="2"  width="2"  height="2" fill="#ff0000"/>
      <rect x="10" y="2"  width="6"  height="2" fill="#ff0000"/>
      <rect x="0"  y="4"  width="16" height="2" fill="#ff0000"/>
      <rect x="0"  y="6"  width="16" height="2" fill="#ff0000"/>
      <rect x="2"  y="8"  width="12" height="2" fill="#ff0000"/>
      <rect x="4"  y="10" width="8"  height="2" fill="#ff0000"/>
      <rect x="6"  y="12" width="4"  height="2" fill="#ff0000"/>
      <rect x="7"  y="14" width="2"  height="2" fill="#ff0000"/>
      <rect x="1"  y="2"  width="1"  height="1" fill="#ff6666"/>
      <rect x="9"  y="2"  width="1"  height="1" fill="#ff6666"/>
    </svg>
  );
}

/* ─── GitHub icon ────────────────────────────────────────────────────────── */

function GitHubIcon({ fixed }: { fixed?: boolean }) {
  return (
    <a
      href="https://github.com/tusharpanthri/wolfiedex/tree/frontend"
      target="_blank"
      rel="noopener noreferrer"
      title="View on GitHub"
      style={{
        position: fixed ? "fixed" : "absolute",
        top: "16px",
        right: "16px",
        zIndex: 9999,
        opacity: 0.85,
        transition: "opacity 0.2s ease",
        lineHeight: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <a
      href="https://github.com/tusharpanthri?tab=repositories"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "fixed",
        bottom: "10px",
        left: "20px",
        zIndex: 9999,
        fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
        fontSize: "9px",
        color: "#ffffff",
        textDecoration: "none",
        display: "flex",
        alignItems: "center",
      }}
    >
      © Made with <PixelHeart /> for SBU
    </a>
  );
}

/* ─── Chip query expander ─────────────────────────────────────────────────── */

const expandQuery = (q: string): string => {
  const chipMap: Record<string, string> = {
    "Today":      "What events are happening on campus today?",
    "Free Food":  "Are there any events on campus today that offer free food?",
    "Late Night": "What events are happening on campus after 8PM tonight?",
    "Sports":     "What sports events or games are happening on campus this week?",
    "Career":     "Are there any career fairs, networking events, or info sessions on campus this week?",
  };
  return chipMap[q] || q;
};

/* ─── Home component ─────────────────────────────────────────────────────── */

export default function Home() {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [messages, setMessages] = useState<{ query: string; response: string; isTyping: boolean; primaryEvents: PrimaryEvent[]; similarEvents: SimilarEvent[] }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bottomQuery, setBottomQuery] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const bottomInputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to newest message */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Focus bottom input when entering chat mode */
  useEffect(() => {
    if (isSearchMode) {
      bottomInputRef.current?.focus();
    }
  }, [isSearchMode]);

  const callSearchAPI = async (query: string) => {
    const res = await fetch('http://localhost:3001/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        currentDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
      })
    })
    if (!res.ok) throw new Error('Search failed')
    return res.json()
  }

  /* Home screen submit — fade out → switch → fade in */
  const handleSubmit = async (overrideQuery?: string) => {
    const raw = overrideQuery || "";
    if (!raw.trim()) return;
    const expanded = expandQuery(raw);
    setOpacity(0);
    setIsTransitioning(true);
    setTimeout(() => {
      setIsSearchMode(true);
      setOpacity(1);
      setIsTransitioning(false);
    }, 300);
    setMessages(prev => [...prev, {
      query: expanded,
      response: '',
      isTyping: true,
      primaryEvents: [],
      similarEvents: []
    }]);
    setIsLoading(true);
    try {
      const data = await callSearchAPI(expanded);
      const text = data.ai_response;
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            response: text.slice(0, i)
          };
          return updated;
        });
        if (i === text.length) {
          clearInterval(interval);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              isTyping: false,
              primaryEvents: data.primary_events,
              similarEvents: data.similar_events
            };
            return updated;
          });
          setIsLoading(false);
        }
      }, 30);
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          response: 'Oops! Could not reach the server. Try again.',
          isTyping: false,
          primaryEvents: [],
          similarEvents: []
        };
        return updated;
      });
      setIsLoading(false);
    }
  };

  /* Bottom chat input submit */
  const handleChatSubmit = async () => {
    const raw = bottomQuery.trim();
    if (!raw) return;
    const expanded = expandQuery(raw);
    setBottomQuery("");
    setMessages(prev => [...prev, {
      query: expanded,
      response: '',
      isTyping: true,
      primaryEvents: [],
      similarEvents: []
    }]);
    setIsLoading(true);
    try {
      const data = await callSearchAPI(expanded);
      const text = data.ai_response;
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            response: text.slice(0, i)
          };
          return updated;
        });
        if (i === text.length) {
          clearInterval(interval);
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              isTyping: false,
              primaryEvents: data.primary_events,
              similarEvents: data.similar_events
            };
            return updated;
          });
          setIsLoading(false);
        }
      }, 30);
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          response: 'Oops! Could not reach the server. Try again.',
          isTyping: false,
          primaryEvents: [],
          similarEvents: []
        };
        return updated;
      });
      setIsLoading(false);
    }
  };

  /* ── HOME SCREEN ────────────────────────────────────────────────────────── */
  if (!isSearchMode) {
    return (
      <>
        <div style={{ opacity, transition: "opacity 0.3s ease" }}>
          <div
            style={{
              width: "100vw",
              overflowX: "hidden",
              overflowY: "auto",
              position: "relative",
            }}
          >
            {/* Background image */}
            <Image
              src="/wolfiedex-bg.png"
              alt="WolfieDex background"
              width={1920}
              height={1080}
              style={{ width: "100%", height: "auto", imageRendering: "pixelated", display: "block" }}
              priority
            />

            {/* Overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: "35vh",
              }}
            >
              <GitHubIcon />
              <QueryInput onSubmit={(q) => handleSubmit(q)} />

              {/* Filter chips */}
              <div style={{
                display: "flex",
                gap: "10px",
                marginTop: "-42px",
                marginLeft: "-24px",
                flexWrap: "nowrap",
                justifyContent: "center",
                alignItems: "center",
              }}>
                {["Today", "Free Food", "Late Night", "Sports", "Career"].map((chip, i) => (
                  <React.Fragment key={chip}>
                    <button
                      onClick={() => handleSubmit(chip)}
                      style={{
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.4)",
                        color: "#ffffff",
                        fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                        fontSize: "8px",
                        padding: "6px 12px",
                        cursor: "pointer",
                        borderRadius: "4px",
                        backdropFilter: "blur(4px)",
                        transition: "background 0.2s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.35)")}
                    >
                      {chip}
                    </button>
                    {i < 4 && (
                      <span style={{
                        color: "rgba(255,255,255,0.5)",
                        fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                        fontSize: "10px",
                      }}>|</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </>
    );
  }

  /* ── CHAT SCREEN ────────────────────────────────────────────────────────── */
  return (
    <>
      <div style={{ opacity, transition: "opacity 0.3s ease" }}>
        {/* Blurred background — fixed, full screen, behind everything */}
        <Image
          src="/wolfiedex-bg.png"
          alt="WolfieDex background"
          width={1920}
          height={1080}
          style={{
            filter: "blur(3px)",
            transform: "scale(1.05)",
            position: "fixed",
            inset: 0,
            zIndex: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            imageRendering: "pixelated",
          }}
          priority
        />

        {/* Back arrow */}
        <button
          onClick={() => {
            setOpacity(0);
            setTimeout(() => {
              setIsSearchMode(false);
              setMessages([]);
              setOpacity(1);
            }, 300);
          }}
          style={{
            position: "fixed",
            top: "20px",
            left: "20px",
            zIndex: 9999,
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "14px",
            color: "#ffffff",
            background: "rgba(0,0,0,0.5)",
            border: "2px solid rgba(255,255,255,0.6)",
            padding: "8px 14px",
            cursor: "pointer",
          }}
        >
          ←
        </button>

        <GitHubIcon fixed />

        {/* Chat window */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            padding: "80px 15% 120px 15%",
          }}
        >
          {messages.map((message, index) => (
            <div key={index} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

              {/* Query bubble — right aligned */}
              <div
                style={{
                  alignSelf: "flex-end",
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                  fontSize: "10px",
                  color: "white",
                  maxWidth: "60%",
                  lineHeight: "1.8",
                }}
              >
                {message.query}
              </div>

              {/* Response bubble — left aligned */}
              {(message.response || message.isTyping) && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "12px",
                    padding: "16px 20px",
                    fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                    fontSize: "10px",
                    color: "white",
                    maxWidth: "75%",
                    lineHeight: "2",
                  }}
                >
                  {message.response}
                  {message.isTyping && (
                    <span style={{ opacity: 0.7 }} className="blink-cursor">▌</span>
                  )}
                </div>
              )}

              {message.primaryEvents?.length > 0 && (
                <div style={{ alignSelf: 'flex-start', width: '75%', marginTop: '8px' }}>
                  <div style={{
                    fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                    fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px'
                  }}>TOP MATCHES</div>
                  {message.primaryEvents.map((e, i) => (
                    <EventCard key={i} {...e} variant="primary" />
                  ))}
                </div>
              )}

              {message.similarEvents?.length > 0 && (
                <div style={{ alignSelf: 'flex-start', width: '75%', marginTop: '12px' }}>
                  <div style={{
                    fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                    fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px'
                  }}>YOU MIGHT ALSO LIKE</div>
                  {message.similarEvents.map((e, i) => (
                    <EventCard key={i} {...e} variant="similar" />
                  ))}
                </div>
              )}

            </div>
          ))}

          {/* Scroll anchor */}
          <div ref={chatEndRef} />
        </div>

        {/* Bottom input — 50% wide, centered */}
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            left: "25%",
            width: "50%",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              aspectRatio: "1048 / 356",
              backgroundImage: "url(/search-box.png)",
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
              position: "relative",
            }}
          >
            <input
              ref={bottomInputRef}
              autoFocus
              value={bottomQuery}
              onChange={(e) => setBottomQuery(e.target.value)}
              placeholder="Type here..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChatSubmit();
              }}
              style={{
                position: "absolute",
                left: "5%",
                right: "18%",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "var(--font-press-start), 'Press Start 2P', monospace",
                fontSize: "11px",
                color: "#000000",
                caretColor: "#000000",
                paddingLeft: "20px",
                width: "77%",
              }}
            />

            <button
              onClick={handleChatSubmit}
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
        </div>
      </div>

      <Footer />
    </>
  );
}
