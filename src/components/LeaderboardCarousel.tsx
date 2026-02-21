"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { formatNumber } from "@/lib/utils";

interface LeaderboardTrend {
  direction: "up" | "down" | "stable" | "new";
  places: number;
  hasHistory: boolean;
}

interface TrophyEntry {
  tag: string;
  name: string;
  rank: number;
  trophies: number;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface RankedEntry {
  tag: string;
  name: string;
  rank: number;
  elo: number;
  rankLabel: string;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface EsportEntry {
  tag: string;
  displayName: string;
  team: string;
  earningsUsd: number;
  matcherinoUrl: string | null;
  iconId?: number | null;
  trend?: LeaderboardTrend;
}

interface LeaderboardCarouselProps {
  trophyLeaders: TrophyEntry[];
  rankedLeaders: RankedEntry[];
  esportLeaders: EsportEntry[];
  errors?: {
    trophy?: string | null;
    ranked?: string | null;
    esport?: string | null;
  };
}

const DEFAULT_ICON_URL = "https://cdn.brawlify.com/profile-icons/regular/28000000.png";

function iconUrl(iconId?: number | null): string {
  return `https://cdn.brawlify.com/profile-icons/regular/${iconId ?? 28000000}.png`;
}

function PlayerIcon({ iconId, alt }: { iconId?: number | null; alt: string }) {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-white">
      <img
        src={iconUrl(iconId)}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onError={(event) => {
          const image = event.currentTarget;
          if (image.dataset.fallbackApplied === "1") return;
          image.dataset.fallbackApplied = "1";
          image.src = DEFAULT_ICON_URL;
        }}
      />
    </div>
  );
}

function TrendBadge({ trend }: { trend?: LeaderboardTrend }) {
  if (!trend || !trend.hasHistory) return null;
  if (trend.direction === "up") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">+{trend.places}</span>;
  }
  if (trend.direction === "down") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">-{trend.places}</span>;
  }
  return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">=</span>;
}

function Board({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_-35px_rgba(15,23,42,0.7)]">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function LeaderboardCarousel({ trophyLeaders, rankedLeaders, esportLeaders, errors }: LeaderboardCarouselProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Board title="Top Ranked" subtitle="Joueurs suivis (score connu)">
        {rankedLeaders.length === 0 ? (
          <p className="text-sm text-rose-600">{errors?.ranked ?? "Top ranked indisponible."}</p>
        ) : (
          rankedLeaders.map((player) => (
            <Link
              key={player.tag}
              href={`/player/${encodeURIComponent(player.tag)}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-300"
            >
              <div className="w-8 text-center text-sm font-bold text-slate-700">#{player.rank}</div>
              <PlayerIcon iconId={player.iconId} alt={player.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-900">{player.name}</p>
                  <TrendBadge trend={player.trend} />
                </div>
                <p className="text-xs text-slate-600">
                  {player.rankLabel} • {formatNumber(player.elo)} ELO
                </p>
              </div>
            </Link>
          ))
        )}
      </Board>

      <Board title="Top Trophes" subtitle="Classement mondial">
        {trophyLeaders.length === 0 ? (
          <p className="text-sm text-rose-600">{errors?.trophy ?? "Top trophes indisponible."}</p>
        ) : (
          trophyLeaders.map((player) => (
            <Link
              key={player.tag}
              href={`/player/${encodeURIComponent(player.tag)}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-300"
            >
              <div className="w-8 text-center text-sm font-bold text-slate-700">#{player.rank}</div>
              <PlayerIcon iconId={player.iconId} alt={player.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-900">{player.name}</p>
                  <TrendBadge trend={player.trend} />
                </div>
                <p className="text-xs text-slate-600">{formatNumber(player.trophies)} trophes</p>
              </div>
            </Link>
          ))
        )}
      </Board>

      <Board title="Top Cashprize" subtitle="Matcherino (Supabase)">
        {esportLeaders.length === 0 ? (
          <p className="text-sm text-rose-600">{errors?.esport ?? "Top cashprize indisponible."}</p>
        ) : (
          esportLeaders.map((entry, index) => (
            <article key={entry.tag} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="w-8 text-center text-sm font-bold text-slate-700">#{index + 1}</div>
              <PlayerIcon iconId={entry.iconId} alt={entry.displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-900">{entry.displayName}</p>
                  <TrendBadge trend={entry.trend} />
                </div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{entry.team}</p>
                <p className="text-xs text-slate-700">${formatNumber(entry.earningsUsd)}</p>
              </div>
              {entry.matcherinoUrl ? (
                <a href={entry.matcherinoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-700 underline">
                  Matcherino
                </a>
              ) : null}
            </article>
          ))
        )}
      </Board>
    </div>
  );
}
