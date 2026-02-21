"use client";

import { useMemo, useState } from "react";

import { CompareTool } from "@/components/compare-tool";
import { BattlelogAnalytics } from "@/lib/metrics";
import { formatRank } from "@/lib/utils";
import { BattleItem } from "@/types/brawl";

type TabKey = "ranked" | "trophies" | "history" | "versus";

interface PlayerTabsProps {
  playerTag: string;
  analytics: BattlelogAnalytics;
  battlelog: BattleItem[];
  rankedElo: number;
  currentRankLabel?: string | null;
  highestRankedTrophies?: number | null;
  trophiesCurrent: number;
  trophiesBest: number;
}

function stat(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

function winrateLabel(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}

function parseBattleTime(value: string | undefined): Date | null {
  if (!value || value.trim() === "") return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value.trim());
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function localizeBattleTime(value: string | undefined): string {
  const parsed = parseBattleTime(value);
  if (!parsed) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function battleOutcome(item: BattleItem): { label: string; tone: "win" | "loss" | "draw" | "unknown" } {
  const result = String(item.battle?.result ?? "").toLowerCase();
  if (result.includes("victory") || result.includes("win")) return { label: "Victoire", tone: "win" };
  if (result.includes("defeat") || result.includes("loss") || result.includes("lose")) return { label: "Defaite", tone: "loss" };
  if (result.includes("draw")) return { label: "Egalite", tone: "draw" };
  if (typeof item.battle?.rank === "number") {
    if (item.battle.rank === 1) return { label: "Victoire", tone: "win" };
    if (item.battle.rank > 1) return { label: "Defaite", tone: "loss" };
  }
  return { label: "Inconnu", tone: "unknown" };
}

function outcomeClass(tone: "win" | "loss" | "draw" | "unknown"): string {
  if (tone === "win") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "loss") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "draw") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function SmallList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Aucune donnee disponible.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function PlayerTabs({
  playerTag,
  analytics,
  battlelog,
  rankedElo,
  currentRankLabel = null,
  highestRankedTrophies = null,
  trophiesCurrent,
  trophiesBest
}: PlayerTabsProps) {
  const [tab, setTab] = useState<TabKey>("ranked");

  const recentMatches = useMemo(
    () =>
      battlelog.slice(0, 60).map((item, index) => {
        const mode = String(item.event?.mode ?? item.battle?.mode ?? "").trim() || "Mode inconnu";
        const map = String(item.event?.map ?? "").trim() || "Map inconnue";
        const outcome = battleOutcome(item);
        const trophyChange = typeof item.battle?.trophyChange === "number" ? item.battle.trophyChange : null;

        return {
          id: `${item.battleTime ?? "unknown"}-${index}`,
          mode,
          map,
          date: localizeBattleTime(item.battleTime),
          outcome,
          trophyChange
        };
      }),
    [battlelog]
  );

  const rankedLabel = currentRankLabel && currentRankLabel.trim() !== "" ? currentRankLabel : rankedElo > 0 ? formatRank(rankedElo) : "Indisponible";
  const rankedPeak = Math.max(rankedElo, Number(highestRankedTrophies ?? 0));

  const rankedMaps = analytics.mapsRanked.slice(0, 5).map((map) => `${map.map} - ${map.matches} matchs (${map.winrate}%)`);
  const trophyMaps = analytics.mapsTrophies
    .slice(0, 5)
    .map((map) => `${map.map} - ${map.matches} matchs (${map.winrate}%)`);

  const rankedBrawlers = analytics.topBrawlersRanked
    .slice(0, 6)
    .map((brawler) => `${brawler.name} - ${brawler.matches} matchs (${brawler.winrate}%)`);
  const trophyBrawlers = analytics.topBrawlersTrophies
    .slice(0, 6)
    .map((brawler) => `${brawler.name} - ${brawler.matches} matchs (${brawler.winrate}%)`);

  const rankedBans = analytics.rankedBans
    .slice(0, 6)
    .map((ban) => `${ban.name} - ${ban.bans} bans`);
  const rankedBansRows =
    rankedBans.length > 0
      ? rankedBans
      : ["Non disponible via l'API officielle (bans non exposes dans le battlelog recent)."];

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["ranked", "Ranked"],
          ["trophies", "Trophes"],
          ["history", "Historique"],
          ["versus", "Versus"]
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ranked" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Niveau Ranked</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{rankedLabel}</p>
              <p className="text-sm text-slate-600">
                {rankedElo > 0
                  ? `${stat(rankedElo)} ELO`
                  : "Score ELO indisponible (joueur hors top classe ou source externe non accessible)."}
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Winrate Ranked</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{winrateLabel(analytics.rankedWinrate25)}</p>
              <p className="text-sm text-slate-600">25 derniers matchs classes</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Mode Saison</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{winrateLabel(analytics.rankedSeasonWinrate)}</p>
              <p className="text-sm text-slate-600">Estimation sur logs recents</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Record Ranked</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{rankedPeak > 0 ? formatRank(rankedPeak) : "N/A"}</p>
              <p className="text-sm text-slate-600">Meilleur score connu</p>
            </article>
          </div>

          {analytics.seasonIsEstimated ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Le winrate "saison" est une estimation: l'API officielle ne fournit pas l'historique complet de saison.
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <SmallList title="Maps les plus jouees (ranked, 25 derniers matchs)" rows={rankedMaps} />
            <SmallList title="Brawlers les plus joues (ranked, 25 derniers matchs)" rows={rankedBrawlers} />
            <SmallList title="Brawlers les plus bannis (ranked, 25 derniers matchs)" rows={rankedBansRows} />
          </div>
        </div>
      ) : null}

      {tab === "trophies" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Trophes actuels</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stat(trophiesCurrent)}</p>
              <p className="text-sm text-slate-600">Etat live</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Record de trophes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{stat(trophiesBest)}</p>
              <p className="text-sm text-slate-600">Meilleur total</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Winrate Trophes</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{winrateLabel(analytics.trophyWinrate25)}</p>
              <p className="text-sm text-slate-600">25 derniers matchs</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Sample disponible</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{analytics.trophySampleMatches}</p>
              <p className="text-sm text-slate-600">Matchs exploites</p>
            </article>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <SmallList title="Maps les plus jouees (trophes)" rows={trophyMaps} />
            <SmallList title="Brawlers les plus joues (trophes)" rows={trophyBrawlers} />
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Historique des matchs recents</h2>
          <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            API officielle: historique recent uniquement (pas l'historique complet de toute la saison).
          </p>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun match recent disponible.</p>
          ) : (
            <ul className="space-y-2">
              {recentMatches.map((match) => (
                <li key={match.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${outcomeClass(match.outcome.tone)}`}>
                        {match.outcome.label}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900">{match.map}</p>
                      <p className="truncate text-xs uppercase tracking-[0.12em] text-slate-500">{match.mode}</p>
                    </div>
                    <p className="text-xs text-slate-500">{match.date}</p>
                  </div>
                  {match.trophyChange !== null ? (
                    <p className="mt-1 text-xs text-slate-600">Variation trophees: {match.trophyChange > 0 ? `+${match.trophyChange}` : match.trophyChange}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "versus" ? <CompareTool defaultLeftTag={playerTag} /> : null}
    </section>
  );
}
