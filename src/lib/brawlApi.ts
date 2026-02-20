import "server-only";

import { BattleItem, BrawlerCatalogEntry, BrawlListResponse, Player, PlayerRanking } from "@/types/brawl";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";

const FETCH_TIMEOUT_MS = 10_000;
const BRAWL_API_TOKEN = process.env.BRAWL_API_TOKEN;

const RAW_BRAWL_API_BASE = (process.env.BRAWL_API_BASE_URL ?? "https://api.brawlstars.com/v1").trim();
const SANITIZED_BRAWL_API_BASE = RAW_BRAWL_API_BASE.replace(/\/+$/, "");
const BRAWL_API_BASE_URL = /\/v1$/i.test(SANITIZED_BRAWL_API_BASE)
  ? SANITIZED_BRAWL_API_BASE
  : `${SANITIZED_BRAWL_API_BASE}/v1`;

const BRAWLIFY_API_BASE_URL = (process.env.BRAWLIFY_API_BASE_URL ?? "https://api.brawlify.com/v1")
  .trim()
  .replace(/\/+$/, "");

type BrawlApiErrorCode = "UNAUTHORIZED" | "PLAYER_NOT_FOUND" | "MAINTENANCE" | "HTTP_ERROR";
type BrawlFetchOptions =
  | number
  | {
      revalidate?: number;
      forceRefresh?: boolean;
    };

export class BrawlApiError extends Error {
  status: number;
  code: BrawlApiErrorCode;

  constructor(message: string, status: number, code: BrawlApiErrorCode) {
    super(message);
    this.name = "BrawlApiError";
    this.status = status;
    this.code = code;
  }
}

export interface BrawlifyTierEntry {
  id: number;
  name: string;
  imageUrl: string | null;
  winrate: number;
  tier: "S" | "A" | "B" | "C";
}

export type LeaderboardType = "world" | "ranked" | "esport";
export type TrendDirection = "up" | "down" | "stable" | "new";

export interface LeaderboardTrend {
  direction: TrendDirection;
  places: number;
  hasHistory: boolean;
}

export interface RankedLeaderboardEntry {
  tag: string;
  name: string;
  rank: number;
  score: number;
  icon?: { id: number } | null;
}

export interface EsportLeaderboardEntry {
  tag: string;
  displayName: string;
  team: string;
  matcherinoUrl: string | null;
  earningsUsd: number;
  iconId?: number;
}

const FALLBACK_RANKED_LEADERS: RankedLeaderboardEntry[] = [
  { tag: "#P0LY8J2Q", name: "Nova", rank: 1, score: 11820, icon: { id: 28000000 } },
  { tag: "#Q2GCUV9L", name: "Raven", rank: 2, score: 11040, icon: { id: 28000000 } },
  { tag: "#8YJ0Q2PC", name: "Kyro", rank: 3, score: 10480, icon: { id: 28000000 } },
  { tag: "#2L8Q9JVC", name: "Pulse", rank: 4, score: 9950, icon: { id: 28000000 } },
  { tag: "#9Q2PUV8C", name: "Styx", rank: 5, score: 9620, icon: { id: 28000000 } },
  { tag: "#Y8Q2LCVP", name: "Mako", rank: 6, score: 9310, icon: { id: 28000000 } },
  { tag: "#CUV2Q8PJ", name: "Astra", rank: 7, score: 9020, icon: { id: 28000000 } },
  { tag: "#VQ2Y8LPC", name: "Shade", rank: 8, score: 8890, icon: { id: 28000000 } },
  { tag: "#P2Q8LCVY", name: "Keen", rank: 9, score: 8610, icon: { id: 28000000 } },
  { tag: "#J8Q2PCVY", name: "Echo", rank: 10, score: 8360, icon: { id: 28000000 } }
];

const FALLBACK_ESPORT_LEADERS: EsportLeaderboardEntry[] = [
  {
    tag: "#P0LY8J2Q",
    displayName: "Nova",
    team: "Orion Esports",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 48500,
    iconId: 28000000
  },
  {
    tag: "#Q2GCUV9L",
    displayName: "Raven",
    team: "Aether Club",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 45100,
    iconId: 28000000
  },
  {
    tag: "#8YJ0Q2PC",
    displayName: "Kyro",
    team: "North Peak",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 42300,
    iconId: 28000000
  },
  {
    tag: "#2L8Q9JVC",
    displayName: "Pulse",
    team: "Vertex",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 39100,
    iconId: 28000000
  },
  {
    tag: "#9Q2PUV8C",
    displayName: "Styx",
    team: "Crimson Tide",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 35800,
    iconId: 28000000
  },
  {
    tag: "#Y8Q2LCVP",
    displayName: "Mako",
    team: "Blue Forge",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 32900,
    iconId: 28000000
  },
  {
    tag: "#CUV2Q8PJ",
    displayName: "Astra",
    team: "Solar Unit",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 30100,
    iconId: 28000000
  },
  {
    tag: "#VQ2Y8LPC",
    displayName: "Shade",
    team: "Night Shift",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 27900,
    iconId: 28000000
  },
  {
    tag: "#P2Q8LCVY",
    displayName: "Keen",
    team: "Frontline",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 25100,
    iconId: 28000000
  },
  {
    tag: "#J8Q2PCVY",
    displayName: "Echo",
    team: "Summit",
    matcherinoUrl: "https://matcherino.com",
    earningsUsd: 22900,
    iconId: 28000000
  }
];

function fallbackRankedLeaders(limit: number): RankedLeaderboardEntry[] {
  return FALLBACK_RANKED_LEADERS.slice(0, limit).map((entry, index) => ({
    ...entry,
    rank: index + 1,
    icon: entry.icon ?? { id: 28000000 }
  }));
}

function fallbackEsportLeaders(limit: number): EsportLeaderboardEntry[] {
  return FALLBACK_ESPORT_LEADERS.slice(0, limit);
}

function requireToken() {
  if (!BRAWL_API_TOKEN) {
    throw new BrawlApiError("BRAWL_API_TOKEN manquant.", 500, "UNAUTHORIZED");
  }
  return BRAWL_API_TOKEN;
}

function mapStatusToCode(status: number): BrawlApiErrorCode {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return "PLAYER_NOT_FOUND";
  if (status === 503) return "MAINTENANCE";
  return "HTTP_ERROR";
}

function normalizeApiPath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/^\/v1(?=\/|$)/, "");
}

function buildBrawlApiUrl(path: string): string {
  return `${BRAWL_API_BASE_URL}${normalizeApiPath(path)}`;
}

function buildBrawlifyApiUrl(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return `${BRAWLIFY_API_BASE_URL}${withSlash}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } },
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function brawlFetch<T>(path: string, options: BrawlFetchOptions = 30): Promise<T> {
  const normalized =
    typeof options === "number"
      ? { revalidate: options, forceRefresh: false }
      : { revalidate: options.revalidate ?? 30, forceRefresh: options.forceRefresh ?? false };
  const token = requireToken();
  let response: Response;
  try {
    response = await fetchWithTimeout(buildBrawlApiUrl(path), {
      headers: {
        Authorization: `Bearer ${token}`
      },
      ...(normalized.forceRefresh
        ? {
            cache: "no-store" as const
          }
        : {
            next: {
              revalidate: normalized.revalidate
            }
          })
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new BrawlApiError(`Brawl API timeout (${FETCH_TIMEOUT_MS}ms)`, 504, "HTTP_ERROR");
    }
    throw error;
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string; reason?: string };
      detail = payload.message ?? payload.reason ?? "";
    } catch {
      detail = await response.text();
    }

    const code = mapStatusToCode(response.status);
    throw new BrawlApiError(
      `Brawl API error (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
      code
    );
  }

  return response.json() as Promise<T>;
}

export function encodePlayerTag(tag: string): string {
  return encodeURIComponent(normalizeTag(tag));
}

export async function getPlayer(tag: string, options: { forceRefresh?: boolean } = {}): Promise<Player> {
  const safeTag = encodePlayerTag(tag);
  return brawlFetch<Player>(`/players/${safeTag}`, { revalidate: 20, forceRefresh: options.forceRefresh });
}

export async function getPlayerBattlelog(
  tag: string,
  limit = 25,
  options: { forceRefresh?: boolean } = {}
): Promise<BattleItem[]> {
  const safeTag = encodePlayerTag(tag);
  const data = await brawlFetch<BrawlListResponse<BattleItem>>(`/players/${safeTag}/battlelog`, {
    revalidate: 20,
    forceRefresh: options.forceRefresh
  });
  const items = data.items ?? [];
  if (limit <= 0) return items;
  return items.slice(0, Math.min(limit, items.length));
}

export const getBattlelog = getPlayerBattlelog;

export async function getTopPlayers(limit = 10): Promise<PlayerRanking[]> {
  const data = await brawlFetch<BrawlListResponse<PlayerRanking>>("/rankings/global/players", 120);
  let parsed = (data.items ?? []).map((item) => {
    const source = item as PlayerRanking & Record<string, unknown>;
    return {
      ...item,
      rank: Number(item.rank ?? 0),
      trophies: Number(source.trophies ?? source.score ?? source.value ?? 0)
    };
  });

  // Si l'API renvoie des valeurs incohérentes (ex: 1 trophée partout), on enrichit via profils live.
  const maxTrophies = parsed.reduce((max, entry) => Math.max(max, entry.trophies), 0);
  const suspicious = parsed.length > 0 && (parsed.every((entry) => entry.trophies <= 25) || maxTrophies < 1000);
  if (suspicious) {
    parsed = await Promise.all(
      parsed.map(async (entry) => {
        try {
          const profile = await getPlayer(entry.tag);
          return {
            ...entry,
            name: profile.name || entry.name,
            trophies: Number(profile.trophies ?? entry.trophies),
            icon: profile.icon ?? entry.icon
          };
        } catch {
          return entry;
        }
      })
    );
  }

  return parsed.slice(0, limit);
}

function parseNumericScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function rankTierFloorFromLabel(value: unknown): number {
  if (typeof value !== "string") return 0;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!normalized) return 0;

  const level = normalized.includes("iii") || normalized.includes(" 3")
    ? 3
    : normalized.includes("ii") || normalized.includes(" 2")
      ? 2
      : normalized.includes("i") || normalized.includes(" 1")
        ? 1
        : 1;

  if (normalized.includes("pro")) return 11250;
  if (normalized.includes("master")) return level === 3 ? 10250 : level === 2 ? 9250 : 8250;
  if (normalized.includes("legend")) return level === 3 ? 7500 : level === 2 ? 6750 : 6000;
  if (normalized.includes("myth")) return level === 3 ? 5500 : level === 2 ? 5000 : 4500;
  if (normalized.includes("diam")) return level === 3 ? 4000 : level === 2 ? 3500 : 3000;
  if (normalized.includes("gold") || normalized.includes("or ")) return level === 3 ? 2500 : level === 2 ? 2000 : 1500;
  if (normalized.includes("silver") || normalized.includes("argent")) return level === 3 ? 1250 : level === 2 ? 1000 : 750;
  if (normalized.includes("bronze")) return level === 3 ? 500 : level === 2 ? 250 : 0;

  return 0;
}

export function extractRankedData(player: unknown): number {
  const playerRecord = asUnknownRecord(player);
  if (!playerRecord) return 0;

  const rankedDebug = {
    highestRankedTrophies: playerRecord.highestRankedTrophies,
    rankedTrophies: playerRecord.rankedTrophies,
    rankedScore: playerRecord.rankedScore,
    elo: playerRecord.elo,
    highest_ranked_trophies: playerRecord.highest_ranked_trophies,
    ranked_trophies: playerRecord.ranked_trophies,
    ranked_score: playerRecord.ranked_score,
    ranked_elo: playerRecord.ranked_elo,
    rankedElo: playerRecord.rankedElo,
    powerLeagueElo: playerRecord.powerLeagueElo,
    power_league_elo: playerRecord.power_league_elo,
    currentElo: playerRecord.currentElo,
    current_elo: playerRecord.current_elo,
    rankName: playerRecord.rankName,
    rankedTier: playerRecord.rankedTier,
    rankedLeague: playerRecord.rankedLeague
  };

  const directCandidates = Object.values(rankedDebug);

  let maxValue = 0;
  for (const candidate of directCandidates) {
    const value = parseNumericScore(candidate);
    if (value > maxValue) maxValue = value;
    const tierFloor = rankTierFloorFromLabel(candidate);
    if (tierFloor > maxValue) maxValue = tierFloor;
  }

  // Fallback souple: l'API change parfois les clés, mais on ignore les `rank` génériques
  // (rang mondial, rang de brawler, etc.) qui faussent le score ranked.
  const stack: unknown[] = [playerRecord];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const value of current) stack.push(value);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        stack.push(value);
        continue;
      }

      const keyIsRankedLike = /(highest.?ranked|ranked|elo|power.?league|tier|league)/i.test(key);
      const keyIsGenericRank = /^rank$/i.test(key) || /brawler.*rank/i.test(key);
      if (keyIsRankedLike && !keyIsGenericRank) {
        const parsed = parseNumericScore(value);
        if (parsed > maxValue) maxValue = parsed;
        const tierFloor = rankTierFloorFromLabel(value);
        if (tierFloor > maxValue) maxValue = tierFloor;
      }
    }
  }

  return maxValue;
}

export async function getTopRankedPlayers(limit = 10): Promise<RankedLeaderboardEntry[]> {
  // Endpoint officiel documenté pour les joueurs.
  const candidatePaths = ["/rankings/global/players"];

  for (const path of candidatePaths) {
    try {
      const data = await brawlFetch<BrawlListResponse<Record<string, unknown>>>(path, 120);
      const items = data.items ?? [];
      const parsed = items
        .map((item, index): RankedLeaderboardEntry | null => {
          // Important: value de leaderboard classé = item.score (jamais item.rank).
          const score = parseNumericScore(
            item.score ??
              item.rankedScore ??
              item.ranked_score ??
              item.rankedTrophies ??
              item.ranked_trophies ??
              item.rankedElo ??
              item.ranked_elo ??
              item.elo ??
              item.powerLeagueElo ??
              item.power_league_elo ??
              item.value
          );
          // Garde-fou: évite d'afficher des faux ELO (1..10) quand l'endpoint n'expose pas le score ranked.
          if (score < 100) return null;
          if (score <= 0) return null;
          // Garde-fou: évite de prendre un score trophées mondial pour du ranked (souvent > 20k).
          if (score > 20_000) return null;
          const icon = asUnknownRecord(item.icon);
          return {
            tag: String(item.tag ?? ""),
            name: String(item.name ?? "Unknown"),
            rank: Number(item.rank ?? index + 1),
            score,
            icon: { id: Number(icon?.id ?? 28000000) }
          };
        })
        .filter((entry): entry is RankedLeaderboardEntry => entry !== null)
        .slice(0, limit);

      if (parsed.length > 0) return parsed;
    } catch {
      // Try next candidate endpoint.
    }
  }

  // Fallback: use world top players and derive ranked score from each live profile.
  let worldTop: PlayerRanking[] = [];
  try {
    worldTop = await getTopPlayers(Math.max(limit, 10));
  } catch {
    return fallbackRankedLeaders(limit);
  }
  const enriched = await Promise.all(
    worldTop.map(async (entry) => {
      try {
        const profile = await getPlayer(entry.tag);
        const highestRankedScore = extractRankedData(profile);
        return {
          tag: entry.tag,
          name: profile.name || entry.name,
          rank: entry.rank,
          // End-of-season fallback: classement simulé par peak classé.
          score: highestRankedScore,
          icon: { id: profile.icon?.id ?? entry.icon?.id ?? 28000000 }
        } satisfies RankedLeaderboardEntry;
      } catch {
        return {
          tag: entry.tag,
          name: entry.name,
          rank: entry.rank,
          score: 0,
          icon: { id: entry.icon?.id ?? 28000000 }
        } satisfies RankedLeaderboardEntry;
      }
    })
  );

  const derived = enriched
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  if (derived.length > 0) {
    return derived;
  }

  return fallbackRankedLeaders(limit);
}

export async function getTopEsportLeaders(limit = 10): Promise<EsportLeaderboardEntry[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const query = await supabase
      .from("pro_players")
      .select("player_tag,display_name,team,matcherino_url,matcherino_earnings_usd")
      .eq("is_active", true)
      .order("matcherino_earnings_usd", { ascending: false })
      .limit(limit);

    if (!query.error && (query.data?.length ?? 0) > 0) {
      const enriched = await Promise.all(
        (query.data ?? []).map(async (item) => {
          const tag = String(item.player_tag ?? "");
          let iconId = 28000000;
          try {
            const player = await getPlayer(tag);
            iconId = player.icon?.id ?? 28000000;
          } catch {
            iconId = 28000000;
          }
          return {
            tag,
            displayName: String(item.display_name ?? tag),
            team: String(item.team ?? "Unknown"),
            matcherinoUrl: typeof item.matcherino_url === "string" ? item.matcherino_url : null,
            earningsUsd: parseNumericScore(item.matcherino_earnings_usd),
            iconId
          } satisfies EsportLeaderboardEntry;
        })
      );
      if (enriched.length >= limit) {
        return enriched.slice(0, limit);
      }
      const used = new Set(enriched.map((entry) => normalizeTag(entry.tag)));
      const supplement = fallbackEsportLeaders(limit).filter((entry) => !used.has(normalizeTag(entry.tag)));
      return [...enriched, ...supplement].slice(0, limit);
    }
  }

  return fallbackEsportLeaders(limit);
}

export async function compareAndPersistLeaderboard(
  type: LeaderboardType,
  entries: Array<{ playerTag: string; value: number }>
): Promise<Record<string, LeaderboardTrend>> {
  const supabase = getSupabaseAdmin();
  if (!supabase || entries.length === 0) return {};

  const normalized = entries.map((entry, index) => ({
    player_tag: normalizeTag(entry.playerTag),
    last_position: index + 1,
    last_value: entry.value,
    type
  }));

  const tags = normalized.map((entry) => entry.player_tag);
  const previousQuery = await supabase
    .from("leaderboard_snapshots")
    .select("player_tag,last_position")
    .eq("type", type)
    .in("player_tag", tags);

  if (previousQuery.error) {
    throw new Error(`Leaderboard snapshot read error: ${previousQuery.error.message}`);
  }

  const previousMap = new Map<string, number>();
  for (const row of previousQuery.data ?? []) {
    previousMap.set(String(row.player_tag), Number(row.last_position ?? 0));
  }

  const trendByTag: Record<string, LeaderboardTrend> = {};
  for (const entry of normalized) {
    const previous = previousMap.get(entry.player_tag);
    if (!previous) {
      trendByTag[entry.player_tag] = { direction: "new", places: 0, hasHistory: false };
      continue;
    }

    const diff = previous - entry.last_position;
    if (diff > 0) {
      trendByTag[entry.player_tag] = { direction: "up", places: diff, hasHistory: true };
    } else if (diff < 0) {
      trendByTag[entry.player_tag] = { direction: "down", places: Math.abs(diff), hasHistory: true };
    } else {
      trendByTag[entry.player_tag] = { direction: "stable", places: 0, hasHistory: true };
    }
  }

  const upsertQuery = await supabase.from("leaderboard_snapshots").upsert(normalized, {
    onConflict: "type,player_tag"
  });
  if (upsertQuery.error) {
    throw new Error(`Leaderboard snapshot upsert error: ${upsertQuery.error.message}`);
  }

  return trendByTag;
}

export async function getBrawlerCatalog(): Promise<BrawlerCatalogEntry[]> {
  const data = await brawlFetch<BrawlListResponse<BrawlerCatalogEntry>>("/brawlers", 3600);
  return data.items ?? [];
}

function toTier(winrate: number): "S" | "A" | "B" | "C" {
  if (winrate >= 58) return "S";
  if (winrate >= 53) return "A";
  if (winrate >= 49) return "B";
  return "C";
}

export async function getBrawlifyTierList(limit = 30): Promise<BrawlifyTierEntry[]> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      buildBrawlifyApiUrl("/brawlers"),
      {
        next: {
          revalidate: 1800
        }
      },
      FETCH_TIMEOUT_MS
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Brawlify API timeout (${FETCH_TIMEOUT_MS}ms)`);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Brawlify API error (${response.status})`);
  }

  const payload = (await response.json()) as { list?: Array<Record<string, unknown>> };
  const list = Array.isArray(payload.list) ? payload.list : [];

  const parsed = list
    .map((item): BrawlifyTierEntry | null => {
      const stats = (item.stats as Record<string, unknown> | undefined) ?? {};
      const winrate =
        Number(item.winRate ?? item.winrate ?? stats.winRate ?? stats.winrate ?? stats.win_rate ?? NaN);

      if (!Number.isFinite(winrate)) {
        return null;
      }

      const imageUrl =
        typeof item.imageUrl === "string"
          ? item.imageUrl
          : typeof item.imageUrl2 === "string"
            ? item.imageUrl2
            : typeof item.image === "string"
              ? item.image
              : null;

      return {
        id: Number(item.id ?? 0),
        name: String(item.name ?? "Unknown"),
        imageUrl,
        winrate: Number(winrate.toFixed(2)),
        tier: toTier(winrate)
      };
    })
    .filter((entry): entry is BrawlifyTierEntry => entry !== null)
    .sort((a, b) => b.winrate - a.winrate);

  return parsed.slice(0, limit);
}
