import type { Metadata } from "next";
import Link from "next/link";

import { CompareTool } from "@/components/compare-tool";
import { TopEarningsBoard } from "@/components/top-earnings-board";
import { getPlayer } from "@/lib/brawlApi";
import { getTopProPlayersByEarnings } from "@/lib/supabase";
import { formatNumber } from "@/lib/utils";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Cashprize Brawl Stars",
  description: "Profils pros, cashprize Matcherino et comparaison versus.",
  alternates: {
    canonical: "/esport"
  }
};

interface DisplayPro {
  tag: string;
  handle: string;
  team: string;
  matcherinoUrl: string;
  earningsUsd: number;
}

export default async function EsportPage() {
  const topEarnings = await getTopProPlayersByEarnings(10).catch(() => []);

  const displayPros: DisplayPro[] = topEarnings.map((pro) => ({
    tag: pro.player_tag,
    handle: pro.display_name,
    team: pro.team,
    matcherinoUrl: pro.matcherino_url ?? "https://matcherino.com/",
    earningsUsd: Number(pro.matcherino_earnings_usd ?? 0)
  }));

  const players = await Promise.all(
    displayPros.map(async (pro) => {
      try {
        const live = await getPlayer(pro.tag);
        return { ...pro, live };
      } catch {
        return { ...pro, live: null };
      }
    })
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold text-slate-900">Top Cashprize</h1>
        <p className="mt-2 text-sm text-slate-600">
          Profils pros verifies, earnings Matcherino et comparaison face-a-face.
        </p>
      </section>

      <TopEarningsBoard
        entries={topEarnings.map((pro) => ({
          tag: pro.player_tag,
          displayName: pro.display_name,
          team: pro.team,
          earningsUsd: Number(pro.matcherino_earnings_usd ?? 0),
          matcherinoUrl: pro.matcherino_url
        }))}
      />

      {displayPros.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Aucune donnee esport disponible dans la table <code>pro_players</code>.
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        {players.map((pro) => (
          <article key={pro.tag} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{pro.team}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{pro.handle}</h2>
            <p className="text-sm text-slate-600">{pro.tag}</p>
            <p className="mt-2 text-sm text-slate-700">Cashprize: ${formatNumber(pro.earningsUsd)}</p>
            <p className="text-sm text-slate-700">Trophes live: {pro.live ? formatNumber(pro.live.trophies) : "indisponible"}</p>
            <div className="mt-3 flex items-center justify-between">
              <a href={pro.matcherinoUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700 underline">
                Matcherino
              </a>
              <Link href={`/player/${encodeURIComponent(pro.tag)}`} className="text-sm text-slate-700 underline">
                Voir profil
              </Link>
            </div>
          </article>
        ))}
      </section>

      <CompareTool />
    </div>
  );
}
