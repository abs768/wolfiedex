/*
  layout.tsx — the "shell" that wraps every page in your app.

  In Next.js App Router, every route shares this layout unless you create
  a nested layout inside a subfolder. Think of it like an HTML template —
  the <html> and <body> tags live here so you only write them once.
*/

import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

/*
  Load "Press Start 2P" from Google Fonts using Next.js's built-in font system.
  Next.js downloads the font at build time and self-hosts it — no extra network
  request to Google on each page load.

  `variable` creates a CSS custom property (--font-pixel) that we can reference
  in CSS. `subsets: ["latin"]` downloads only the Latin character set to keep
  the file size small.
*/
const pressStart2P = Press_Start_2P({
  weight: "400",       // Press Start 2P only has one weight: 400 (regular)
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",     // show fallback text immediately while font loads
});

/*
  Metadata is how Next.js sets the <title> and <meta description> tags in <head>.
  This is better than writing raw <head> tags because Next.js merges metadata
  across nested layouts automatically.
*/
export const metadata: Metadata = {
  title: "WolfieDex",
  description: "Your Stony Brook University event guide",
};

/*
  RootLayout receives `children` — whatever page is currently being visited.
  Next.js renders the right page component and passes it here as {children}.
*/
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
      We attach the font's CSS variable to <html> so it's available everywhere.
      The actual font-family is applied in globals.css using var(--font-pixel).
    */
    <html lang="en">
      <body className={pressStart2P.variable} style={{ overflowX: "hidden" }}>{children}</body>
    </html>
  );
}
