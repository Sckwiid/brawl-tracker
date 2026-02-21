import type { Metadata } from "next";

import { LeaderboardCarousel } from "@/components/LeaderboardCarousel";
import { TagSearchForm } from "@/components/tag-search-form";
import {
  BrawlApiError,
  type LeaderboardTrend,
  compareAndPersistLeaderboard,
  getTopEsportLeaders,
  getTopPlayers,
  getTopRankedPlayers
} from "@/lib/brawlApi";
import { formatRank, normalizeTag } from "@/lib/utils";

export const revalidate = 90;
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Brawl Tracker - Home",
  description: "Tracker Brawl Stars moderne: top ranked, top trophes, top cashprize Matcherino et recherche rapide.",
  alternates: {
    canonical: "/"
  }
};

export default async function HomePage() {
  let topPlayersError: string | null = null;
  let rankedError: string | null = null;
  let esportError: string | null = null;

  let trophyLeaders: Array<{
    tag: string;
    name: string;
    rank: number;
    trophies: number;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];
  let rankedLeaders: Array<{
    tag: string;
    name: string;
    rank: number;
    elo: number;
    rankLabel: string;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];
  let esportLeaders: Array<{
    tag: string;
    displayName: string;
    team: string;
    earningsUsd: number;
    matcherinoUrl: string | null;
    iconId?: number | null;
    trend?: LeaderboardTrend;
  }> = [];

  try {
    const topPlayers = await getTopPlayers(10);
    trophyLeaders = topPlayers.map((player) => ({
      tag: player.tag,
      name: player.name,
      rank: player.rank,
      trophies: player.trophies,
      iconId: player.icon?.id ?? 28000000
    }));
  } catch (error) {
    if (error instanceof BrawlApiError) {
      topPlayersError = `Top trophes indisponible (HTTP ${error.status}).`;
    } else if (error instanceof Error) {
      topPlayersError = `Top trophes indisponible (${error.message}).`;
    } else {
      topPlayersError = "Top trophes indisponible (erreur inconnue).";
    }
  }

  try {
    const ranked = await getTopRankedPlayers(10);
    rankedLeaders = ranked.map((player) => ({
      tag: player.tag,
      name: player.name,
      rank: player.rank,
      elo: player.score,
      rankLabel: player.score > 0 ? formatRank(player.score) : "Non classe",
      iconId: player.icon?.id ?? 28000000
    }));
  } catch (error) {
    rankedError =
      error instanceof Error
        ? error.message
        : "Classement ranked indisponible. Recherche quelques joueurs pour alimenter ce top.";
  }

  try {
    const topEarnings = await getTopEsportLeaders(10);
    if (topEarnings.length === 0) {
      esportError = "Aucune donnee earnings dans `pro_players`.";
    } else {
      esportLeaders = topEarnings.map((pro) => ({
        tag: pro.tag,
        displayName: pro.displayName,
        team: pro.team,
        earningsUsd: Number(pro.earningsUsd ?? 0),
        matcherinoUrl: pro.matcherinoUrl,
        iconId: pro.iconId ?? 28000000
      }));
    }
  } catch (error) {
    esportError = error instanceof Error ? error.message : "Top cashprize indisponible.";
  }

  try {
    const worldTrend = await compareAndPersistLeaderboard(
      "world",
      trophyLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.trophies }))
    );
    trophyLeaders = trophyLeaders.map((entry) => ({
      ...entry,
      trend: worldTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Keep board visible even when trend persistence fails.
  }

  try {
    const rankedTrend = await compareAndPersistLeaderboard(
      "ranked",
      rankedLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.elo }))
    );
    rankedLeaders = rankedLeaders.map((entry) => ({
      ...entry,
      trend: rankedTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Keep board visible even when trend persistence fails.
  }

  try {
    const esportTrend = await compareAndPersistLeaderboard(
      "esport",
      esportLeaders.map((entry) => ({ playerTag: entry.tag, value: entry.earningsUsd }))
    );
    esportLeaders = esportLeaders.map((entry) => ({
      ...entry,
      trend: esportTrend[normalizeTag(entry.tag)]
    }));
  } catch {
    // Keep board visible even when trend persistence fails.
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_60px_-40px_rgba(15,23,42,0.7)]">
        <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-cyan-100 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />

        <p className="relative text-sm uppercase tracking-[0.2em] text-slate-500">Brawl Stars Tracker</p>
        <h1 className="relative mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Interface simple, moderne et centree ranked
        </h1>
        <p className="relative mt-3 max-w-3xl text-slate-600">
          Recherche un joueur par tag, compare les profils et suis les tendances: top ranked, top trophes et top cashprize
          Matcherino.
        </p>
        <TagSearchForm className="relative mt-6" />
      </section>

      <LeaderboardCarousel
        trophyLeaders={trophyLeaders}
        rankedLeaders={rankedLeaders}
        esportLeaders={esportLeaders}
        errors={{
          trophy:
            topPlayersError ??
            "Top trophes indisponible. Verifie BRAWL_API_TOKEN, l'acces proxy et la disponibilite de l'API.",
          ranked: rankedError,
          esport: esportError
        }}
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Notes API: l'API officielle n'expose pas un top ranked global fiable. Le bloc "Top Ranked" affiche donc les joueurs
        deja suivis (snapshots valides). Le cashprize vient de la table Supabase `pro_players`.
      </section>
    </div>
  );
}
