"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CompareTool } from "@/components/compare-tool";
import { BattlelogAnalytics } from "@/lib/metrics";
import { HistoryRow } from "@/lib/supabase";
import { formatRank } from "@/lib/utils";

type TabKey = "ranked" | "trophies" | "history" | "versus";

interface PlayerTabsProps {
  playerTag: string;
  analytics: BattlelogAnalytics;
  rankedElo: number;
  currentRankLabel?: string | null;
  highestRankedTrophies?: number | null;
  trophiesCurrent: number;
  trophiesBest: number;
  history: HistoryRow[];
}

function localizeDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function stat(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

function winrateLabel(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
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
  rankedElo,
  currentRankLabel = null,
  highestRankedTrophies = null,
  trophiesCurrent,
  trophiesBest,
  history
}: PlayerTabsProps) {
  const [tab, setTab] = useState<TabKey>("ranked");

  const chartData = useMemo(
    () =>
      history.map((item) => ({
        date: localizeDate(item.snapshot_date),
        trophies: item.trophies,
        max: item.highest_trophies
      })),
    [history]
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
          <h2 className="text-lg font-semibold text-slate-900">Evolution trophes / record</h2>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun snapshot journalier disponible pour le moment.</p>
          ) : (
            <div className="h-72 w-full rounded-2xl border border-slate-200 bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="trophies" stroke="#0284c7" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="max" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : null}

      {tab === "versus" ? <CompareTool defaultLeftTag={playerTag} /> : null}
    </section>
  );
}
