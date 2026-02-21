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
const BRAWLAPI_V1_BASE_URL = (process.env.BRAWLAPI_V1_BASE_URL ?? "https://api.brawltools.com")
  .trim()
  .replace(/\/+$/, "");
const BRAWLAPI_V1_TOKEN = process.env.BRAWLAPI_V1_TOKEN?.trim() ?? "";
const BRAWLAPI_DEBUG = process.env.BRAWLAPI_DEBUG === "1";
const BRAWLYTIX_BASE_URL = "https://brawlytix.com";
const BRAWLYTIX_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
};

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

function buildBrawlApiV1PlayerUrls(tag: string): string[] {
  const normalized = normalizeTag(tag);
  const withoutHash = normalized.replace(/^#/, "");
  const bases = [...new Set([BRAWLAPI_V1_BASE_URL, "https://api.brawltools.com"].map((value) => value.trim()).filter(Boolean))];
  const urls: string[] = [];

  for (const base of bases) {
    const normalizedBase = base.toLowerCase();
    const useApiKey = BRAWLAPI_V1_TOKEN && !normalizedBase.includes("api.brawltools.com");
    const tokenSuffix = useApiKey ? `&api_key=${encodeURIComponent(BRAWLAPI_V1_TOKEN)}` : "";
    urls.push(`${base}/player?tag=${encodeURIComponent(normalized)}${tokenSuffix}`);
    urls.push(`${base}/player?tag=${encodeURIComponent(withoutHash)}${tokenSuffix}`);
    urls.push(`${base}/players?tag=${encodeURIComponent(normalized)}${tokenSuffix}`);
    urls.push(`${base}/players?tag=${encodeURIComponent(withoutHash)}${tokenSuffix}`);
    urls.push(`${base}/v1/player?tag=${encodeURIComponent(normalized)}${tokenSuffix}`);
    urls.push(`${base}/v1/player?tag=${encodeURIComponent(withoutHash)}${tokenSuffix}`);
    urls.push(`${base}/player/${encodeURIComponent(withoutHash)}${useApiKey ? `?api_key=${encodeURIComponent(BRAWLAPI_V1_TOKEN)}` : ""}`);
    urls.push(`${base}/players/${encodeURIComponent(withoutHash)}${useApiKey ? `?api_key=${encodeURIComponent(BRAWLAPI_V1_TOKEN)}` : ""}`);
    urls.push(`${base}/v1/player/${encodeURIComponent(withoutHash)}${useApiKey ? `?api_key=${encodeURIComponent(BRAWLAPI_V1_TOKEN)}` : ""}`);
    urls.push(`${base}/v1/players/${encodeURIComponent(withoutHash)}${useApiKey ? `?api_key=${encodeURIComponent(BRAWLAPI_V1_TOKEN)}` : ""}`);
  }

  return urls;
}

function collectStringForKeys(source: unknown, allowedKeys: Set<string>): string[] {
  const values: string[] = [];
  const stack: unknown[] = [source];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizeLookupKey(key);
      if (allowedKeys.has(normalizedKey)) {
        if (typeof value === "string" && value.trim() !== "") {
          values.push(value.trim());
        } else if (value && typeof value === "object") {
          for (const nested of Object.values(value as Record<string, unknown>)) {
            if (typeof nested === "string" && nested.trim() !== "") {
              values.push(nested.trim());
            }
          }
        }
      }
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

export function encodePlayerTag(tag: string): string {
  return encodeURIComponent(normalizeTag(tag));
}

interface ExternalRankedSnapshot {
  score: number;
  rankLabel: string | null;
  peakScore?: number;
}

function hasListLikeContainer(record: Record<string, unknown>): boolean {
  return ["items", "list", "results", "players", "data"].some((key) => Array.isArray(record[key]));
}

function findRecordByTag(source: unknown, expectedTag: string): Record<string, unknown> | null {
  const stack: unknown[] = [source];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }

    const record = current as Record<string, unknown>;
    if (typeof record.tag === "string" && normalizeTag(record.tag) === expectedTag) {
      return record;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return null;
}

export function extractRankedLabel(player: unknown): string | null {
  const labels = collectStringForKeys(player, RANKED_TIER_LABEL_KEYS);
  for (const label of labels) {
    if (rankTierFloorFromLabel(label) > 0) return label;
  }
  return labels[0] ?? null;
}

async function getExternalRankedSnapshot(tag: string, forceRefresh = false): Promise<ExternalRankedSnapshot | null> {
  const normalizedTag = normalizeTag(tag);
  if (!isPossibleBrawlTag(normalizedTag)) return null;

  const attempts: string[] = [];

  // Priorite Brawlytix: c'est la source la plus fiable pour score/ranked elo aujourd'hui.
  const brawlytixSnapshot = await getBrawlytixRankedSnapshot(normalizedTag, forceRefresh);
  attempts.push(brawlytixSnapshot.attempt);
  if (brawlytixSnapshot.snapshot) {
    return brawlytixSnapshot.snapshot;
  }

  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  const baseForAuth = BRAWLAPI_V1_BASE_URL.toLowerCase();
  const shouldAttachAuth = Boolean(BRAWLAPI_V1_TOKEN) && !baseForAuth.includes("api.brawltools.com");
  if (shouldAttachAuth) {
    headers.Authorization = `Bearer ${BRAWLAPI_V1_TOKEN}`;
    headers["x-api-key"] = BRAWLAPI_V1_TOKEN;
  }

  const urls = [...new Set(buildBrawlApiV1PlayerUrls(normalizedTag))];

  for (const url of urls) {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        forceRefresh
          ? {
              headers,
              cache: "no-store"
            }
          : {
              headers,
              next: {
                revalidate: 30
              }
            }
      );
    } catch {
      attempts.push(`${url} -> network_error`);
      continue;
    }

    if (!response.ok) {
      attempts.push(`${url} -> http_${response.status}`);
      continue;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      attempts.push(`${url} -> invalid_json`);
      continue;
    }

    const root = asUnknownRecord(payload);
    const taggedRecord = findRecordByTag(payload, normalizedTag);
    if (!taggedRecord && root && hasListLikeContainer(root)) {
      attempts.push(`${url} -> list_without_tag`);
      continue;
    }

    const source = taggedRecord ?? payload;
    const score = extractRankedData(source);
    const rankLabel = extractRankedLabel(source);
    if (score <= 0 && !rankLabel) {
      attempts.push(`${url} -> no_rank_fields`);
      continue;
    }

    return {
      score,
      rankLabel
    };
  }

  if (BRAWLAPI_DEBUG) {
    console.warn(`[brawlapi] no ranked snapshot for ${normalizedTag}. attempts=${attempts.join(" | ")}`);
  }

  return null;
}

export async function getPlayer(tag: string, options: { forceRefresh?: boolean } = {}): Promise<Player> {
  const safeTag = encodePlayerTag(tag);
  const player = await brawlFetch<Player>(`/players/${safeTag}`, { revalidate: 20, forceRefresh: options.forceRefresh });

  try {
    const external = await getExternalRankedSnapshot(player.tag, Boolean(options.forceRefresh));
    if (!external) return player;

    const enriched = { ...player } as Player & Record<string, unknown>;
    if (external.score > 0) {
      enriched.elo = external.score;
      enriched.rankedScore = external.score;
      enriched.ranked_score = external.score;
    }
    if ((external.peakScore ?? 0) > 0) {
      const peak = Number(external.peakScore ?? 0);
      enriched.highestRankedTrophies = peak;
      enriched.highest_ranked_trophies = peak;
    }
    if (external.rankLabel) {
      enriched.rankName = external.rankLabel;
      enriched.currentRankName = external.rankLabel;
      enriched.rankedTier = external.rankLabel;
      enriched.currentRankedTier = external.rankLabel;
    }
    return enriched as Player;
  } catch {
    return player;
  }
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
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const normalized = trimmed.replace(/[\u00A0\s,]/g, "");
    if (Number.isFinite(Number(normalized))) return Number(normalized);
  }
  return 0;
}

function asUnknownRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

const MAX_REASONABLE_RANKED_SCORE = 20_000;

const CURRENT_RANKED_KEYS = new Set([
  "rankscore",
  "rankpoints",
  "rankedpoints",
  "rankedpoint",
  "rankpoint",
  "elo",
  "currentelo",
  "currentrankedelo",
  "currentrankedscore",
  "rankedelo",
  "rankedscore",
  "rankedtrophies",
  "powerleagueelo",
  "powermatchelo"
]);

const PEAK_RANKED_KEYS = new Set([
  "highestrankedpoints",
  "bestrankedpoints",
  "maxrankedpoints",
  "peakrankedpoints",
  "highestrankedtrophies",
  "bestrankedtrophies",
  "bestrankedelo",
  "bestelo",
  "maxrankedelo",
  "peakrankedelo",
  "rankedrecord"
]);

const RANKED_TIER_LABEL_KEYS = new Set([
  "rank",
  "currentrank",
  "bestrank",
  "rankname",
  "league",
  "tier",
  "rankedtier",
  "rankedleague",
  "currentrankname",
  "currentrankedtier",
  "currentrankedleague"
]);

const BRAWL_TAG_PATTERN = /^#[0289PYLQGRJCUV]+$/;

function normalizeLookupKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isPossibleBrawlTag(tag: string): boolean {
  return BRAWL_TAG_PATTERN.test(tag.toUpperCase());
}

function sanitizeRankedScore(value: number): number {
  if (value <= 0 || value > MAX_REASONABLE_RANKED_SCORE) return 0;
  return value;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    });
}

function stripHtml(input: string): string {
  const withoutScripts = input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  return decodeHtmlEntities(withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectRegexScores(source: string, pattern: RegExp, sanitize = true): number[] {
  const values: number[] = [];
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const raw = match[1] ?? "";
    const parsed = parseNumericScore(raw);
    if (!Number.isFinite(parsed)) continue;
    const score = sanitize ? sanitizeRankedScore(parsed) : parsed;
    if (score > 0 || (!sanitize && score >= 0)) {
      values.push(score);
    }
  }
  return values;
}

function extractStatNumberFromHtml(html: string, label: string): number {
  const escaped = escapeRegexLiteral(label);
  const strict = new RegExp(`<div\\s+class=["']stat["'][^>]*>\\s*([^<]+?)\\s*<label>\\s*${escaped}\\s*<\\/label>`, "i");
  const loose = new RegExp(`([0-9][0-9,\\s.]*)\\s*<label>\\s*${escaped}\\s*<\\/label>`, "i");
  const fromStrict = strict.exec(html)?.[1] ?? "";
  const firstTry = sanitizeRankedScore(parseNumericScore(decodeHtmlEntities(fromStrict)));
  if (firstTry > 0 || parseNumericScore(decodeHtmlEntities(fromStrict)) === 0) return firstTry;
  const fromLoose = loose.exec(html)?.[1] ?? "";
  return sanitizeRankedScore(parseNumericScore(decodeHtmlEntities(fromLoose)));
}

function extractStatNumberFromText(text: string, label: "ranked" | "highest"): number {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (label === "highest") {
    const candidates = [
      ...collectRegexScores(normalized, /([0-9][0-9,\s.]*)\s+Highest\s+Ranked\s+Elo/gi),
      ...collectRegexScores(normalized, /Highest\s+Ranked\s+Elo[^0-9]{0,24}([0-9][0-9,\s.]*)/gi)
    ];
    return candidates.length > 0 ? Math.max(...candidates) : 0;
  }

  const beforeLabelPattern = /([0-9][0-9,\s.]*)\s+Ranked\s+Elo/gi;
  const beforeLabelMatches: number[] = [];
  for (let match = beforeLabelPattern.exec(normalized); match; match = beforeLabelPattern.exec(normalized)) {
    const context = normalized.slice(Math.max(0, match.index - 22), match.index).toLowerCase();
    if (context.includes("highest ranked elo")) continue;
    const parsed = sanitizeRankedScore(parseNumericScore(match[1] ?? ""));
    if (parsed > 0) beforeLabelMatches.push(parsed);
  }
  const afterLabelPattern = /Ranked\s+Elo[^0-9]{0,24}([0-9][0-9,\s.]*)/gi;
  const afterLabelMatches: number[] = [];
  for (let match = afterLabelPattern.exec(normalized); match; match = afterLabelPattern.exec(normalized)) {
    const context = normalized.slice(Math.max(0, match.index - 10), match.index).toLowerCase();
    if (context.includes("highest")) continue;
    const parsed = sanitizeRankedScore(parseNumericScore(match[1] ?? ""));
    if (parsed > 0) afterLabelMatches.push(parsed);
  }

  const candidates = [...beforeLabelMatches, ...afterLabelMatches];
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function extractStatNumberFromPayload(html: string, keys: string[]): number {
  const normalizedKeys = keys.map((key) => escapeRegexLiteral(key));
  const pattern = new RegExp(`["'](?:${normalizedKeys.join("|")})["']\\s*:\\s*["']?([0-9][0-9,\\s.]*)["']?`, "gi");
  const matches = collectRegexScores(html, pattern);
  if (matches.length > 0) {
    return Math.max(...matches);
  }
  return 0;
}

function parseBrawlytixRankedSnapshot(html: string): ExternalRankedSnapshot | null {
  const text = stripHtml(html);
  const current = Math.max(
    extractStatNumberFromHtml(html, "Ranked Elo"),
    extractStatNumberFromText(text, "ranked"),
    extractStatNumberFromPayload(html, ["rankedElo", "rankedScore", "rankscore", "ranked_points", "rankedPoints"])
  );
  const peak = Math.max(
    extractStatNumberFromHtml(html, "Highest Ranked Elo"),
    extractStatNumberFromText(text, "highest"),
    extractStatNumberFromPayload(html, [
      "highestRankedElo",
      "bestRankedElo",
      "peakRankedElo",
      "highestRankedPoints",
      "highest_ranked_trophies"
    ])
  );
  if (current <= 0 && peak <= 0) return null;
  return {
    score: current,
    rankLabel: null,
    peakScore: peak > 0 ? peak : undefined
  };
}

async function getBrawlytixRankedSnapshot(
  normalizedTag: string,
  forceRefresh: boolean
): Promise<{ snapshot: ExternalRankedSnapshot | null; attempt: string }> {
  const withoutHash = normalizedTag.replace(/^#/, "");
  const url = `${BRAWLYTIX_BASE_URL}/profile/${encodeURIComponent(withoutHash)}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      forceRefresh
        ? {
            cache: "no-store",
            headers: BRAWLYTIX_HEADERS
          }
        : {
            next: {
              revalidate: 90
            },
            headers: BRAWLYTIX_HEADERS
          }
    );
  } catch {
    return { snapshot: null, attempt: `${url} -> network_error` };
  }

  if (!response.ok) {
    return { snapshot: null, attempt: `${url} -> http_${response.status}` };
  }

  let html = "";
  try {
    html = await response.text();
  } catch {
    return { snapshot: null, attempt: `${url} -> invalid_html` };
  }

  const lowered = html.toLowerCase();
  if (
    lowered.includes("just a moment") ||
    lowered.includes("enable javascript and cookies") ||
    lowered.includes("cf-challenge") ||
    lowered.includes("cloudflare")
  ) {
    return { snapshot: null, attempt: `${url} -> blocked_or_challenge` };
  }

  const parsed = parseBrawlytixRankedSnapshot(html);
  if (!parsed) {
    return { snapshot: null, attempt: `${url} -> no_rank_fields` };
  }
  return { snapshot: parsed, attempt: `${url} -> ok` };
}

function collectNumericForKeys(source: unknown, allowedKeys: Set<string>): number[] {
  const values: number[] = [];
  const stack: unknown[] = [source];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizeLookupKey(key);
      if (allowedKeys.has(normalizedKey)) {
        let score = sanitizeRankedScore(parseNumericScore(value));
        if (score <= 0 && value && typeof value === "object") {
          const nested = Object.values(value as Record<string, unknown>)
            .map((entry) => sanitizeRankedScore(parseNumericScore(entry)))
            .filter((entry) => entry > 0);
          score = nested.length > 0 ? Math.max(...nested) : 0;
        }
        if (score > 0) {
          values.push(score);
        }
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

function collectTierFloorsForKeys(source: unknown, allowedKeys: Set<string>): number[] {
  const values: number[] = [];
  const stack: unknown[] = [source];
  const seen = new Set<unknown>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = normalizeLookupKey(key);
      if (allowedKeys.has(normalizedKey)) {
        let tierFloor = rankTierFloorFromLabel(value);
        if (tierFloor <= 0 && value && typeof value === "object") {
          const nestedFloors = Object.values(value as Record<string, unknown>)
            .map((entry) => rankTierFloorFromLabel(entry))
            .filter((entry) => entry > 0);
          tierFloor = nestedFloors.length > 0 ? Math.max(...nestedFloors) : 0;
        }
        if (tierFloor > 0) {
          values.push(tierFloor);
        }
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

function isLikelyOfficialPlayerPayload(payload: unknown, expectedTag: string): boolean {
  const record = asUnknownRecord(payload);
  if (!record) return false;

  const payloadTag = normalizeTag(String(record.tag ?? ""));
  const hasValidName = typeof record.name === "string" && record.name.trim() !== "";
  const brawlers = Array.isArray(record.brawlers) ? record.brawlers : null;
  const hasBrawlers = Boolean(brawlers && brawlers.length > 0);
  const trophies = parseNumericScore(record.trophies);
  const highestTrophies = parseNumericScore(record.highestTrophies);

  return payloadTag === expectedTag && hasValidName && hasBrawlers && trophies >= 0 && highestTrophies >= 0;
}

async function getTrackedRankedLeaders(limit: number): Promise<RankedLeaderboardEntry[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("players")
    .select("tag,name,icon_id,raw_payload,last_seen_at,last_snapshot_hash")
    .order("last_seen_at", { ascending: false })
    .limit(800);

  if (query.error) {
    throw new Error(`Supabase read tracked ranked players error: ${query.error.message}`);
  }

  const rows = (query.data ?? []) as Array<{
    tag?: string | null;
    name?: string | null;
    icon_id?: number | null;
    raw_payload?: unknown;
    last_seen_at?: string | null;
    last_snapshot_hash?: string | null;
  }>;

  const parsed = rows
    .map((row) => {
      const tag = normalizeTag(String(row.tag ?? ""));
      if (tag === "#") return null;
      if (!isPossibleBrawlTag(tag)) return null;
      if (!String(row.last_snapshot_hash ?? "").trim()) return null;
      if (!isLikelyOfficialPlayerPayload(row.raw_payload ?? null, tag)) return null;
      const score = extractRankedData(row.raw_payload ?? null);
      if (score <= 0) return null;
      return {
        tag,
        name: String(row.name ?? tag),
        score,
        iconId: Number(row.icon_id ?? 28000000),
        lastSeenAt: String(row.last_seen_at ?? "")
      };
    })
    .filter((entry): entry is { tag: string; name: string; score: number; iconId: number; lastSeenAt: string } => entry !== null);

  const dedupedByTag = new Map<string, { tag: string; name: string; score: number; iconId: number; lastSeenAt: string }>();
  for (const entry of parsed) {
    const existing = dedupedByTag.get(entry.tag);
    if (!existing) {
      dedupedByTag.set(entry.tag, entry);
      continue;
    }
    if (entry.score > existing.score) {
      dedupedByTag.set(entry.tag, entry);
    }
  }

  return [...dedupedByTag.values()]
    .sort((a, b) => b.score - a.score || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit)
    .map((entry, index) => ({
      tag: entry.tag,
      name: entry.name,
      rank: index + 1,
      score: entry.score,
      icon: { id: entry.iconId }
    }));
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
  if (normalized.includes("bronze")) return level === 3 ? 500 : level === 2 ? 250 : 1;

  return 0;
}

export function extractRankedData(player: unknown): number {
  const numericCurrent = collectNumericForKeys(player, CURRENT_RANKED_KEYS);
  const numericPeak = collectNumericForKeys(player, PEAK_RANKED_KEYS);
  const tierFloors = collectTierFloorsForKeys(player, RANKED_TIER_LABEL_KEYS);
  const candidates = [...numericCurrent, ...numericPeak, ...tierFloors];
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

function readRankedScoreFromRankingItem(item: Record<string, unknown>): number {
  const candidates = collectNumericForKeys(item, CURRENT_RANKED_KEYS);
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }
  return 0;
}

function parseBrawlytixRankedLeaderboard(html: string, limit: number): RankedLeaderboardEntry[] {
  const text = stripHtml(html);
  const regex = /#\s*(\d{1,4})\s+([^#]{1,64}?)\s+#([0289PYLQGRJCUV]{3,15})\s+([0-9][0-9,\s.]*)/gi;
  const entries: RankedLeaderboardEntry[] = [];
  const seen = new Set<string>();

  for (let match = regex.exec(text); match; match = regex.exec(text)) {
    const rank = Number.parseInt(match[1], 10);
    const rawName = match[2].replace(/\s+/g, " ").trim();
    const tag = `#${match[3].toUpperCase()}`;
    const score = sanitizeRankedScore(parseNumericScore(match[4]));
    if (!Number.isFinite(rank) || rank <= 0) continue;
    if (!rawName || rawName.length < 2) continue;
    if (!isPossibleBrawlTag(tag)) continue;
    if (score <= 0) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);

    entries.push({
      tag,
      name: rawName,
      rank,
      score,
      icon: { id: 28000000 }
    });
    if (entries.length >= limit) break;
  }

  return entries.sort((a, b) => a.rank - b.rank || b.score - a.score).slice(0, limit);
}

async function getBrawlytixTopRankedPlayers(limit: number): Promise<RankedLeaderboardEntry[]> {
  const url = `${BRAWLYTIX_BASE_URL}/leaderboard/highest-ranked-elo`;
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: BRAWLYTIX_HEADERS,
      next: {
        revalidate: 120
      }
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  let html = "";
  try {
    html = await response.text();
  } catch {
    return [];
  }
  return parseBrawlytixRankedLeaderboard(html, limit);
}

export async function getTopRankedPlayers(limit = 10): Promise<RankedLeaderboardEntry[]> {
  const brawlytixLeaders = await getBrawlytixTopRankedPlayers(limit);
  if (brawlytixLeaders.length > 0) {
    return brawlytixLeaders;
  }

  // Source fiable: joueurs suivis et déjà stockés via snapshots API officiels.
  const tracked = await getTrackedRankedLeaders(limit);
  if (tracked.length > 0) {
    return tracked;
  }

  // Tentative opportuniste: si l'API expose un score ranked explicite sur le ranking players.
  try {
    const data = await brawlFetch<BrawlListResponse<Record<string, unknown>>>("/rankings/global/players", 120);
    const items = data.items ?? [];
    const parsed = items
      .map((item, index): RankedLeaderboardEntry | null => {
        const tag = normalizeTag(String(item.tag ?? ""));
        if (tag === "#") return null;
        if (!isPossibleBrawlTag(tag)) return null;

        const score = readRankedScoreFromRankingItem(item);
        if (score <= 0) return null;

        const icon = asUnknownRecord(item.icon);
        return {
          tag,
          name: String(item.name ?? "Unknown"),
          rank: Number(item.rank ?? index + 1),
          score,
          icon: { id: Number(icon?.id ?? 28000000) }
        };
      })
      .filter((entry): entry is RankedLeaderboardEntry => entry !== null)
      .slice(0, limit);

    if (parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Ignore and raise a clear message below.
  }

  throw new Error("Classement ranked indisponible. L'API officielle ne fournit pas de top ranked global exploitable.");
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
