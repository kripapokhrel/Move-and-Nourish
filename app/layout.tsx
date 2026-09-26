import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// Soft serif for headings, friendly sans for everything else. Self-hosted by next/font.
const display = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK"], variable: "--font-fraunces" });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Move & Nourish",
  description: "Personalized workouts and nutrition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
