import type { Metadata } from "next";
import Link from "next/link";

import { PlayerTabs } from "@/components/player-tabs";
import { RefreshStatsButton } from "@/components/refresh-stats-button";
import { BrawlApiError, extractRankedData, extractRankedLabel, getPlayer } from "@/lib/brawlApi";
import { extractCurrentRankedElo } from "@/lib/metrics";
import { fetchAndStorePlayerSnapshot } from "@/lib/snapshots";
import { formatNumber, formatRank, normalizeTag, toBrawlerSlug } from "@/lib/utils";
import { BrawlerStat, Player } from "@/types/brawl";

interface PlayerPageProps {
  params: { tag: string };
  searchParams?: {
    refresh?: string | string[];
  };
}

function brawlerName(name: BrawlerStat["name"], fallback: number): string {
  if (!name) return `brawler-${fallback}`;
  if (typeof name === "string") return name;
  return Object.values(name)[0] ?? `brawler-${fallback}`;
}

function favoriteBrawlerIcon(player: Player): string {
  const top = [...player.brawlers].sort((a, b) => b.trophies - a.trophies)[0];
  if (!top) {
    return "https://cdn.brawlify.com/brawlers/borderless/shelly.png";
  }
  const name = brawlerName(top.name, top.id);
  return `https://cdn.brawlify.com/brawlers/borderless/${toBrawlerSlug(name)}.png`;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent(params.tag));
  try {
    const player = await getPlayer(tag);
    const image = favoriteBrawlerIcon(player);
    return {
      title: `${player.name} (${player.tag}) - Tracker Brawl Stars`,
      description: `${player.name}: ${player.trophies} trophes, record ${player.highestTrophies}, focus ranked + analyse maps/brawlers.`,
      alternates: {
        canonical: `/player/${encodeURIComponent(tag)}`
      },
      openGraph: {
        title: `${player.name} (${player.tag}) - Tracker Brawl Stars`,
        description: `${player.name}: ${player.trophies} trophes, record ${player.highestTrophies}.`,
        images: [
          {
            url: image,
            alt: `Brawler prefere de ${player.name}`
          }
        ]
      }
    };
  } catch {
    return {
      title: `${tag} - Profil Brawl Stars`,
      description: `Statistiques live et historique de ${tag}.`,
      alternates: {
        canonical: `/player/${encodeURIComponent(tag)}`
      }
    };
  }
}

export const revalidate = 20;
export const dynamic = "force-dynamic";

export default async function PlayerPage({ params, searchParams }: PlayerPageProps) {
  const tag = normalizeTag(decodeURIComponent(params.tag));
  const forceRefresh =
    typeof searchParams?.refresh === "string" ? searchParams.refresh.trim() !== "" : Array.isArray(searchParams?.refresh);

  try {
    const bundle = await fetchAndStorePlayerSnapshot(tag, { forceRefresh });
    const player = bundle.player;
    const currentRankedElo = extractCurrentRankedElo(player);
    const currentRankName = extractRankedLabel(player);
    const peakRankedValue = extractRankedData(player);
    const historyRankedPeak = bundle.history.reduce((max, row) => {
      const raw = row.raw_payload;
      if (!raw || typeof raw !== "object") return max;
      return Math.max(max, extractRankedData(raw as Record<string, unknown>));
    }, 0);
    const bestKnownRanked = Math.max(currentRankedElo, peakRankedValue, historyRankedPeak);
    const displayedRankedElo = currentRankedElo > 0 ? currentRankedElo : bestKnownRanked;
    const isCurrentEstimated = currentRankedElo <= 0 && displayedRankedElo > 0;
    const currentRankLabel = currentRankName ?? (displayedRankedElo > 0 ? formatRank(displayedRankedElo) : "Indisponible");

    const rankedTopMap = bundle.analytics.mapsRanked[0]?.map ?? "N/A";
    const rankedTopBan = bundle.analytics.rankedBans[0]?.name ?? "N/A";

    return (
      <div className="space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.75)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">{player.tag}</p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-900">{player.name}</h1>
              <p className="mt-1 text-sm text-slate-600">Club: {player.club?.name ?? "Sans club"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-right text-sm">
              <p className="text-slate-600">Snapshot: {bundle.changed ? "mis a jour" : "inchange"}</p>
              <p className="font-semibold text-slate-900">{bundle.history.length} points d'historique</p>
            </div>
          </div>
        </header>
        <div className="flex justify-end">
          <RefreshStatsButton />
        </div>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ranked actuel</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{currentRankLabel}</p>
            <p className="text-sm text-slate-600">
              {displayedRankedElo > 0
                ? `${formatNumber(displayedRankedElo)} ELO${isCurrentEstimated ? " (dernier score connu)" : ""}`
                : "ELO ranked indisponible pour ce tag (hors top classe / source externe bloquee)."}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">WR Ranked</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {bundle.analytics.rankedWinrate25 === null ? "N/A" : `${bundle.analytics.rankedWinrate25.toFixed(1)}%`}
            </p>
            <p className="text-sm text-slate-600">25 derniers matchs classes</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Record Ranked</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {bestKnownRanked > 0 ? formatRank(bestKnownRanked) : "N/A"}
            </p>
            <p className="text-sm text-slate-600">Meilleur score connu</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Map ranked principale</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{rankedTopMap}</p>
            <p className="text-sm text-slate-600">Logs recents</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Ban le plus frequent</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{rankedTopBan}</p>
            <p className="text-sm text-slate-600">25 derniers matchs classes</p>
          </article>
        </section>

        <PlayerTabs
          playerTag={player.tag}
          analytics={bundle.analytics}
          rankedElo={displayedRankedElo}
          currentRankLabel={currentRankName}
          highestRankedTrophies={bestKnownRanked}
          trophiesCurrent={player.trophies}
          trophiesBest={player.highestTrophies}
          history={bundle.history}
        />

        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Certaines stats ranked restent limitees: le rang/ELO vient d'une source externe quand disponible, les bans sont
          souvent absents, et la vue "saison" reste une estimation sur les matchs recents.
        </section>

        <p className="text-sm text-slate-500">
          Retour <Link href="/" className="text-sky-700 underline">Home</Link>
        </p>
      </div>
    );
  } catch (error) {
    if (error instanceof BrawlApiError && error.code === "PLAYER_NOT_FOUND") {
      return (
        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Joueur introuvable</h1>
          <p className="mt-2 text-sm text-rose-700">Le tag {tag} n'existe pas ou n'est pas accessible.</p>
          <Link href="/" className="mt-4 inline-block text-sky-700 underline">
            Revenir a l'accueil
          </Link>
        </section>
      );
    }

    if (error instanceof BrawlApiError && error.code === "MAINTENANCE") {
      return (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <h1 className="text-2xl font-semibold text-slate-900">API en maintenance</h1>
          <p className="mt-2 text-sm text-amber-700">Le service Brawl Stars est temporairement indisponible.</p>
          <Link href="/" className="mt-4 inline-block text-sky-700 underline">
            Revenir a l'accueil
          </Link>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Erreur de chargement</h1>
        <p className="mt-2 text-sm text-rose-700">{error instanceof Error ? error.message : "Erreur inconnue."}</p>
      </section>
    );
  }
}
