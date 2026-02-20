import type { Metadata } from "next";
import Link from "next/link";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";

const titleFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-title",
  weight: ["500", "700"]
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Brawl Tracker",
  description: "Tracker Brawl Stars moderne: ranked, trophes, cashprize, historique et comparaison versus.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={`${titleFont.variable} ${bodyFont.variable}`}>
      <body className="font-[var(--font-body)] antialiased">
        <div className="min-h-screen">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="font-[var(--font-title)] text-xl tracking-tight text-slate-900">
                Brawl Tracker
              </Link>
              <div className="flex items-center gap-5 text-sm font-semibold text-slate-600">
                <Link href="/" className="transition hover:text-slate-900">
                  Home
                </Link>
                <Link href="/esport" className="transition hover:text-slate-900">
                  Cashprize
                </Link>
              </div>
            </nav>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-8 pb-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
