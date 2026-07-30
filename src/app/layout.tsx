import type { Metadata } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

// Display font for level numbers, XP counters, headlines — docs/03-design.md §3
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

// Body/UI font for everything else (task titles, forms, buttons, nav) — docs/03-design.md §3
const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atlas",
  description: "Your Second Brain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${pressStart.variable} ${vt323.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden font-sans" suppressHydrationWarning>{children}</body>
    </html>
  );
}
