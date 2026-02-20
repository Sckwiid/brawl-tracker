import type { Metadata } from "next";

import { getMetaTierlist } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meta Brawl Stars - Tier List",
  description: "Tier list live depuis Supabase (table meta_tierlist).",
  alternates: {
    canonical: "/meta"
  },
  openGraph: {
    title: "Meta Brawl Stars - Tier List",
    description: "Tier list live depuis Supabase (table meta_tierlist).",
    images: [
      {
        url: "https://cdn.brawlify.com/brawler/16000000.png",
        alt: "Meta Tier List"
      }
    ]
  }
};

const tierOrder: Record<"S" | "A" | "B" | "C", number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3
};

const tierStyle: Record<"S" | "A" | "B" | "C", string> = {
  S: "border-emerald-400 text-emerald-300",
  A: "border-cyan-400 text-cyan-300",
  B: "border-amber-400 text-amber-300",
  C: "border-rose-400 text-rose-300"
};

export default async function MetaPage() {
  try {
    const entries = await getMetaTierlist();
    const grouped = new Map<string, Array<{ id: string | number; brawler_name: string; tier: "S" | "A" | "B" | "C" }>>();

    for (const entry of entries) {
      if (!grouped.has(entry.mode)) {
        grouped.set(entry.mode, []);
      }
      grouped.get(entry.mode)?.push({
        id: entry.id,
        brawler_name: entry.brawler_name,
        tier: entry.tier
      });
    }

    for (const modeEntries of grouped.values()) {
      modeEntries.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || a.brawler_name.localeCompare(b.brawler_name));
    }

    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
          <h1 className="font-[var(--font-title)] text-3xl text-white">Meta Tier List</h1>
          <p className="mt-2 text-sm text-slate-300">Source: table Supabase `meta_tierlist`.</p>
        </section>

        {entries.length === 0 ? (
          <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
            <p className="text-sm text-slate-300">Aucune entrée meta pour le moment. Ajoute des tiers depuis `/admin`.</p>
          </section>
        ) : null}

        {Array.from(grouped.entries()).map(([mode, modeEntries]) => (
          <section key={mode} className="space-y-3 rounded-2xl border border-slate-700/70 bg-surface-900/80 p-5">
            <h2 className="text-lg font-bold text-white">Mode: {mode}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {modeEntries.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-slate-700 bg-surface-900 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${tierStyle[entry.tier]}`}>
                      Tier {entry.tier}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white">{entry.brawler_name}</h3>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  } catch (error) {
    return (
      <section className="rounded-2xl border border-amber-500/50 bg-surface-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">Meta indisponible</h1>
        <p className="mt-2 text-sm text-amber-200">
          {error instanceof Error ? error.message : "Impossible de lire la table meta_tierlist."}
        </p>
      </section>
    );
  }
}
