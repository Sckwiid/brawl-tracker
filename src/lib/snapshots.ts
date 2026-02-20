import "server-only";

import crypto from "node:crypto";

import { getPlayer, getPlayerBattlelog } from "@/lib/brawlApi";
import {
  calculateWinrate25,
  computeBattlelogAnalytics,
  estimateAccountValue,
  estimatePlayerPlaytime,
  extractRankedElo,
  topPlayedBrawlers,
  type BattlelogAnalytics,
  WinrateBreakdown
} from "@/lib/metrics";
import { getProPlayerByTag, getSupabaseAdmin, HistoryRow, PlayerRow, ProPlayerRow, todayUtcDate } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";
import { BattleItem, Player } from "@/types/brawl";

const SUPABASE_TIMEOUT_MS = 2500;

export interface SnapshotBundle {
  player: Player;
  battlelog: BattleItem[];
  winrates25: WinrateBreakdown;
  analytics: BattlelogAnalytics;
  estimatedPlaytimeHours: number;
  accountValueGems: number;
  rankedElo: number;
  topBrawlers: ReturnType<typeof topPlayedBrawlers>;
  history: HistoryRow[];
  isProVerified: boolean;
  proProfile: ProPlayerRow | null;
  changed: boolean;
}

async function withDbTimeout<T>(task: Promise<T>, timeoutMs = SUPABASE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Supabase timeout after ${timeoutMs}ms`)), timeoutMs);
    task
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => clearTimeout(timer));
  });
}

function snapshotHash(player: Player): string {
  const payload = {
    tag: normalizeTag(player.tag),
    trophies: player.trophies,
    highestTrophies: player.highestTrophies,
    clubTag: player.club?.tag ?? null,
    clubName: player.club?.name ?? null,
    brawlers: [...(player.brawlers ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((brawler) => ({
        id: brawler.id,
        trophies: brawler.trophies,
        highestTrophies: brawler.highestTrophies,
        rank: brawler.rank,
        power: brawler.power
      }))
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function getPlayerRow(tag: string): Promise<PlayerRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const query = await supabase.from("players").select("*").eq("tag", tag).maybeSingle();
  if (query.error && query.error.code !== "PGRST116") {
    throw new Error(`Supabase read players error: ${query.error.message}`);
  }
  return (query.data as PlayerRow | null) ?? null;
}

async function upsertPlayer(
  player: Player,
  hash: string,
  winrate25: number,
  estimatedPlaytimeMinutes: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date().toISOString();
  const payload = {
    tag: normalizeTag(player.tag),
    name: player.name,
    trophies: player.trophies,
    highest_trophies: player.highestTrophies,
    exp_level: player.expLevel ?? null,
    victories_3v3: player["3vs3Victories"] ?? 0,
    solo_victories: player.soloVictories ?? 0,
    duo_victories: player.duoVictories ?? 0,
    club_tag: player.club?.tag ?? null,
    club_name: player.club?.name ?? null,
    icon_id: player.icon?.id ?? null,
    estimated_playtime_minutes: estimatedPlaytimeMinutes,
    last_battlelog_winrate: winrate25,
    last_snapshot_hash: hash,
    raw_payload: player,
    last_seen_at: now,
    updated_at: now
  };

  const query = await supabase.from("players").upsert(payload, { onConflict: "tag" });
  if (query.error) {
    throw new Error(`Supabase upsert players error: ${query.error.message}`);
  }
}

async function upsertDailyHistory(
  player: Player,
  estimatedPlaytimeMinutes: number,
  winrate25: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const payload = {
    player_tag: normalizeTag(player.tag),
    snapshot_date: todayUtcDate(),
    trophies: player.trophies,
    highest_trophies: player.highestTrophies,
    club_tag: player.club?.tag ?? null,
    club_name: player.club?.name ?? null,
    estimated_playtime_minutes: estimatedPlaytimeMinutes,
    winrate_25: winrate25,
    raw_payload: player,
    created_at: new Date().toISOString()
  };

  const query = await supabase.from("history").upsert(payload, { onConflict: "player_tag,snapshot_date" });
  if (query.error) {
    throw new Error(`Supabase upsert history error: ${query.error.message}`);
  }
}

async function upsertAnalyticsSnapshot(
  player: Player,
  analytics: BattlelogAnalytics,
  battlelog: BattleItem[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const now = new Date().toISOString();
  const payload = {
    player_tag: normalizeTag(player.tag),
    snapshot_date: todayUtcDate(),
    ranked_winrate_25: analytics.rankedWinrate25 ?? 0,
    trophy_winrate_25: analytics.trophyWinrate25 ?? 0,
    ranked_matches_sample: analytics.rankedSampleMatches,
    trophy_matches_sample: analytics.trophySampleMatches,
    maps_ranked: analytics.mapsRanked,
    maps_trophies: analytics.mapsTrophies,
    top_brawlers_ranked: analytics.topBrawlersRanked,
    top_brawlers_trophies: analytics.topBrawlersTrophies,
    ranked_bans: analytics.rankedBans,
    battlelog_sample: battlelog,
    updated_at: now
  };

  const query = await supabase.from("player_analytics_snapshots").upsert(payload, {
    onConflict: "player_tag,snapshot_date"
  });
  if (query.error) {
    throw new Error(`Supabase upsert analytics error: ${query.error.message}`);
  }
}

async function getHistory(tag: string): Promise<HistoryRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("history")
    .select("*")
    .eq("player_tag", tag)
    .order("snapshot_date", { ascending: true })
    .limit(120);

  if (query.error) {
    throw new Error(`Supabase read history error: ${query.error.message}`);
  }
  return (query.data as HistoryRow[]) ?? [];
}

async function hasHistory(tag: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const query = await supabase.from("history").select("id").eq("player_tag", tag).limit(1);
  if (query.error) {
    throw new Error(`Supabase read history existence error: ${query.error.message}`);
  }

  return Array.isArray(query.data) && query.data.length > 0;
}

export async function fetchAndStorePlayerSnapshot(tag: string): Promise<SnapshotBundle> {
  const normalizedTag = normalizeTag(tag);
  const [player, battlelog] = await Promise.all([getPlayer(normalizedTag), getPlayerBattlelog(normalizedTag, 60)]);
  const winrates25 = calculateWinrate25(battlelog);
  const analytics = computeBattlelogAnalytics(battlelog, normalizedTag, 60);
  const estimatedPlaytimeHours = estimatePlayerPlaytime(player);
  const estimatedPlaytimeMinutes = Number((estimatedPlaytimeHours * 60).toFixed(2));
  const accountValueGems = estimateAccountValue(player);
  const rankedElo = extractRankedElo(player);
  const topBrawlers = topPlayedBrawlers(player.brawlers, 10);
  const hash = snapshotHash(player);
  const persistedWinrate = winrates25.rankedWinrate ?? winrates25.ladderWinrate ?? winrates25.overall.winrate;

  let changed = true;
  try {
    const previous = await withDbTimeout(getPlayerRow(normalizedTag));
    const historyExists = await withDbTimeout(hasHistory(normalizedTag));
    changed = !previous || previous.last_snapshot_hash !== hash;
    await withDbTimeout(upsertPlayer(player, hash, persistedWinrate, estimatedPlaytimeMinutes));
    await withDbTimeout(upsertAnalyticsSnapshot(player, analytics, battlelog));
    if (changed || !historyExists) {
      await withDbTimeout(upsertDailyHistory(player, estimatedPlaytimeMinutes, persistedWinrate));
    }
  } catch (error) {
    console.error("Snapshot write skipped:", error);
  }

  let history: HistoryRow[] = [];
  try {
    history = await withDbTimeout(getHistory(normalizedTag));
  } catch (error) {
    console.error("History read skipped:", error);
  }

  if (history.length === 0) {
    history = [
      {
        id: 0,
        player_tag: normalizedTag,
        snapshot_date: todayUtcDate(),
        trophies: player.trophies,
        highest_trophies: player.highestTrophies,
        club_tag: player.club?.tag ?? null,
        club_name: player.club?.name ?? "Bienvenue",
        estimated_playtime_minutes: estimatedPlaytimeMinutes,
        winrate_25: persistedWinrate,
        raw_payload: player,
        created_at: new Date().toISOString()
      }
    ];
  }

  let proProfile: ProPlayerRow | null = null;
  try {
    proProfile = await withDbTimeout(getProPlayerByTag(normalizedTag));
  } catch (error) {
    console.error("Pro status read skipped:", error);
  }

  return {
    player,
    battlelog,
    winrates25,
    analytics,
    estimatedPlaytimeHours,
    accountValueGems,
    rankedElo,
    topBrawlers,
    history,
    isProVerified: Boolean(proProfile),
    proProfile,
    changed
  };
}
