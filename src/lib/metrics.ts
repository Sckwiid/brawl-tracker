import { BattleItem, BrawlerStat, Player } from "@/types/brawl";
import { normalizeTag } from "@/lib/utils";

export interface WinrateSummary {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winrate: number;
}

export interface WinrateBreakdown {
  overall: WinrateSummary;
  ranked: WinrateSummary;
  ladder: WinrateSummary;
  rankedWinrate: number | null;
  ladderWinrate: number | null;
}

export interface PlayedBrawler {
  id: number;
  name: string;
  trophies: number;
  highestTrophies: number;
  rank: number;
  power: number;
  prestige: number;
  gamesEstimate: number;
}

export interface ExtractRankedEloOptions {
  fallbackFromDb?: number | null;
}

type MatchType = "ranked" | "ladder" | "other";

type MatchOutcome = "win" | "loss" | "draw";

interface Counter {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
}

interface BrawlerIdentity {
  id: number | null;
  name: string;
}

export interface BattlelogMapStat {
  map: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
}

export interface BattlelogBrawlerUsage {
  id: number | null;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
}

export interface RankedBanStat {
  id: number | null;
  name: string;
  bans: number;
}

export interface BattlelogAnalytics {
  sampledMatches: number;
  rankedSampleMatches: number;
  trophySampleMatches: number;
  rankedWinrate25: number | null;
  trophyWinrate25: number | null;
  rankedSeasonWinrate: number | null;
  seasonIsEstimated: boolean;
  mapsOverall: BattlelogMapStat[];
  mapsRanked: BattlelogMapStat[];
  mapsTrophies: BattlelogMapStat[];
  topBrawlersRanked: BattlelogBrawlerUsage[];
  topBrawlersTrophies: BattlelogBrawlerUsage[];
  rankedBans: RankedBanStat[];
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "") {
      const normalized = trimmed.replace(/[\u00A0\s,]/g, "");
      if (Number.isFinite(Number(normalized))) return Number(normalized);
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

function isWin(result: string): boolean {
  return result.includes("victory") || result.includes("win");
}

function isLoss(result: string): boolean {
  return result.includes("defeat") || result.includes("loss") || result.includes("lose");
}

function emptySummary(): WinrateSummary {
  return { wins: 0, losses: 0, draws: 0, matches: 0, winrate: 0 };
}

function computeWinrate(summary: WinrateSummary): WinrateSummary {
  const matches = summary.wins + summary.losses + summary.draws;
  return {
    ...summary,
    matches,
    winrate: matches > 0 ? Number(((summary.wins / matches) * 100).toFixed(2)) : 0
  };
}

function classifyMatchType(battle: BattleItem): MatchType {
  const mode = String(battle.battle?.mode ?? battle.event?.mode ?? "").toLowerCase();
  const type = String((battle.battle as Record<string, unknown> | undefined)?.type ?? "").toLowerCase();
  const key = `${mode} ${type}`;
  if (
    key.includes("ranked") ||
    key.includes("powermatch") ||
    key.includes("power match") ||
    key.includes("powerleague") ||
    key.includes("power league") ||
    key.includes("soloranked") ||
    key.includes("solo ranked") ||
    key.includes("teamranked") ||
    key.includes("team ranked")
  ) {
    return "ranked";
  }

  if (typeof battle.battle?.trophyChange === "number") {
    return "ladder";
  }

  return "ladder";
}

function addOutcome(summary: WinrateSummary, outcome: MatchOutcome) {
  if (outcome === "win") summary.wins += 1;
  if (outcome === "loss") summary.losses += 1;
  if (outcome === "draw") summary.draws += 1;
}

function parseOutcome(battle: BattleItem): MatchOutcome | null {
  const result = String(battle.battle?.result ?? "").toLowerCase();
  if (isWin(result)) return "win";
  if (isLoss(result)) return "loss";
  if (result.includes("draw")) return "draw";

  if (typeof battle.battle?.rank === "number") {
    return battle.battle.rank === 1 ? "win" : "loss";
  }

  return null;
}

function summarizeFromEntries(entries: Array<{ type: MatchType; outcome: MatchOutcome }>): WinrateBreakdown {
  const overall = emptySummary();
  const ranked = emptySummary();
  const ladder = emptySummary();

  for (const entry of entries) {
    addOutcome(overall, entry.outcome);
    if (entry.type === "ranked") addOutcome(ranked, entry.outcome);
    if (entry.type === "ladder") addOutcome(ladder, entry.outcome);
  }

  const overallSummary = computeWinrate(overall);
  const rankedSummary = computeWinrate(ranked);
  const ladderSummary = computeWinrate(ladder);

  return {
    overall: overallSummary,
    ranked: rankedSummary,
    ladder: ladderSummary,
    rankedWinrate: rankedSummary.matches > 0 ? rankedSummary.winrate : null,
    ladderWinrate: ladderSummary.matches > 0 ? ladderSummary.winrate : null
  };
}

function readableNameFromValue(value: unknown, fallback = "Inconnu"): string {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  const record = asRecord(value);
  if (record) {
    const first = Object.values(record).find((item) => typeof item === "string" && item.trim() !== "");
    if (typeof first === "string") return first.trim();
  }
  return fallback;
}

function parseIdentity(value: unknown, fallbackName: string): BrawlerIdentity | null {
  const obj = asRecord(value);
  if (!obj) {
    const numeric = asNumber(value);
    if (numeric !== null && numeric > 0) {
      return { id: numeric, name: `Brawler #${numeric}` };
    }
    return null;
  }

  const parsedId = asNumber(obj.id);
  const parsedName = readableNameFromValue(obj.name, parsedId !== null ? `Brawler #${parsedId}` : fallbackName);

  if (parsedId === null && parsedName === fallbackName) {
    return null;
  }

  return {
    id: parsedId,
    name: parsedName
  };
}

function mapKey(mapName: string): string {
  return mapName.trim().toLowerCase();
}

function readMapName(item: BattleItem): string {
  const map = String(item.event?.map ?? "").trim();
  return map || "Map inconnue";
}

function increaseCounter(container: Map<string, { label: string; counter: Counter }>, key: string, label: string, outcome: MatchOutcome | null) {
  const found = container.get(key) ?? {
    label,
    counter: { matches: 0, wins: 0, losses: 0, draws: 0 }
  };

  found.counter.matches += 1;
  if (outcome === "win") found.counter.wins += 1;
  if (outcome === "loss") found.counter.losses += 1;
  if (outcome === "draw") found.counter.draws += 1;

  container.set(key, found);
}

function toSortedMapStats(source: Map<string, { label: string; counter: Counter }>, limit = 8): BattlelogMapStat[] {
  return [...source.values()]
    .map(({ label, counter }) => ({
      map: label,
      matches: counter.matches,
      wins: counter.wins,
      losses: counter.losses,
      draws: counter.draws,
      winrate: counter.matches > 0 ? Number(((counter.wins / counter.matches) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.matches - a.matches || b.winrate - a.winrate)
    .slice(0, limit);
}

function brawlerKey(identity: BrawlerIdentity): string {
  if (identity.id !== null) return `id:${identity.id}`;
  return `name:${identity.name.toLowerCase()}`;
}

function collectBrawlerUsage(
  source: Map<string, { identity: BrawlerIdentity; counter: Counter }>,
  identity: BrawlerIdentity,
  outcome: MatchOutcome | null
) {
  const key = brawlerKey(identity);
  const found = source.get(key) ?? {
    identity,
    counter: { matches: 0, wins: 0, losses: 0, draws: 0 }
  };

  found.counter.matches += 1;
  if (outcome === "win") found.counter.wins += 1;
  if (outcome === "loss") found.counter.losses += 1;
  if (outcome === "draw") found.counter.draws += 1;

  source.set(key, found);
}

function toBrawlerUsage(source: Map<string, { identity: BrawlerIdentity; counter: Counter }>, limit = 8): BattlelogBrawlerUsage[] {
  return [...source.values()]
    .map(({ identity, counter }) => ({
      id: identity.id,
      name: identity.name,
      matches: counter.matches,
      wins: counter.wins,
      losses: counter.losses,
      draws: counter.draws,
      winrate: counter.matches > 0 ? Number(((counter.wins / counter.matches) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.matches - a.matches || b.winrate - a.winrate)
    .slice(0, limit);
}

function extractPlayerFromBattleRecord(player: Record<string, unknown>): BrawlerIdentity | null {
  const brawler = parseIdentity(player.brawler, "Brawler inconnu");
  if (brawler) return brawler;

  const brawlerId = asNumber(player.brawlerId);
  if (brawlerId !== null) {
    return { id: brawlerId, name: `Brawler #${brawlerId}` };
  }

  const brawlerName = readableNameFromValue(player.brawlerName, "");
  if (brawlerName) {
    return { id: null, name: brawlerName };
  }

  return null;
}

function extractPlayerBrawler(item: BattleItem, normalizedTag: string): BrawlerIdentity | null {
  const battle = asRecord(item.battle);
  if (!battle) return null;

  const direct = parseIdentity(battle.brawler, "Brawler inconnu");
  if (direct) return direct;

  const fromBrawlers = asArray(battle.brawlers)
    .map((entry) => parseIdentity(entry, "Brawler inconnu"))
    .find((entry) => entry !== null);
  if (fromBrawlers) return fromBrawlers;

  const teamArrays = [...asArray(battle.teams), asArray(battle.players)];
  for (const team of teamArrays) {
    for (const entry of asArray(team)) {
      const player = asRecord(entry);
      if (!player) continue;
      const entryTag = normalizeTag(String(player.tag ?? ""));
      if (entryTag !== normalizedTag) continue;
      const fromPlayer = extractPlayerFromBattleRecord(player);
      if (fromPlayer) return fromPlayer;
    }
  }

  return null;
}

function collectRankedBans(item: BattleItem, target: Map<string, RankedBanStat>): void {
  const battle = asRecord(item.battle);
  if (!battle) return;

  const candidates = [battle.bans, battle.bannedBrawlers, battle.leftBans, battle.rightBans];

  for (const candidate of candidates) {
    for (const raw of asArray(candidate)) {
      const identity = parseIdentity(raw, "Brawler inconnu");
      if (!identity) continue;
      const key = identity.id !== null ? `id:${identity.id}` : `name:${identity.name.toLowerCase()}`;
      const found = target.get(key) ?? {
        id: identity.id,
        name: identity.name,
        bans: 0
      };
      found.bans += 1;
      target.set(key, found);
    }
  }
}

export function calculateWinrate25(battlelog: BattleItem[]): WinrateBreakdown {
  const scanned = battlelog.slice(0, 60);
  const parsed: Array<{ type: MatchType; outcome: MatchOutcome }> = [];

  for (const battle of scanned) {
    const outcome = parseOutcome(battle);
    if (!outcome) continue;
    parsed.push({ type: classifyMatchType(battle), outcome });
    if (parsed.length >= 25) break;
  }

  return summarizeFromEntries(parsed);
}

export function computeBattlelogAnalytics(battlelog: BattleItem[], playerTag: string, scanLimit = 60): BattlelogAnalytics {
  const normalizedTag = normalizeTag(playerTag);
  const scanned = battlelog.slice(0, Math.max(25, scanLimit));
  const focusSample = scanned.slice(0, 25);
  const entries25: Array<{ type: MatchType; outcome: MatchOutcome }> = [];

  const mapsOverall = new Map<string, { label: string; counter: Counter }>();
  const mapsRanked = new Map<string, { label: string; counter: Counter }>();
  const mapsTrophies = new Map<string, { label: string; counter: Counter }>();

  const rankedBrawlers = new Map<string, { identity: BrawlerIdentity; counter: Counter }>();
  const trophyBrawlers = new Map<string, { identity: BrawlerIdentity; counter: Counter }>();
  const rankedBans = new Map<string, RankedBanStat>();

  for (const item of focusSample) {
    const type = classifyMatchType(item);
    const outcome = parseOutcome(item);

    if (outcome && entries25.length < 25) {
      entries25.push({ type, outcome });
    }

    const mapName = readMapName(item);
    const mapToken = mapKey(mapName);
    increaseCounter(mapsOverall, mapToken, mapName, outcome);
    if (type === "ranked") {
      increaseCounter(mapsRanked, mapToken, mapName, outcome);
      collectRankedBans(item, rankedBans);
    }
    if (type === "ladder") {
      increaseCounter(mapsTrophies, mapToken, mapName, outcome);
    }

    const playerBrawler = extractPlayerBrawler(item, normalizedTag);
    if (!playerBrawler) continue;

    if (type === "ranked") {
      collectBrawlerUsage(rankedBrawlers, playerBrawler, outcome);
    } else if (type === "ladder") {
      collectBrawlerUsage(trophyBrawlers, playerBrawler, outcome);
    }
  }

  const breakdown = summarizeFromEntries(entries25);

  return {
    sampledMatches: focusSample.length,
    rankedSampleMatches: breakdown.ranked.matches,
    trophySampleMatches: breakdown.ladder.matches,
    rankedWinrate25: breakdown.rankedWinrate,
    trophyWinrate25: breakdown.ladderWinrate,
    // L'API publique expose seulement un battlelog recent; ce mode "saison" est donc une estimation.
    rankedSeasonWinrate: breakdown.rankedWinrate,
    seasonIsEstimated: true,
    mapsOverall: toSortedMapStats(mapsOverall, 8),
    mapsRanked: toSortedMapStats(mapsRanked, 8),
    mapsTrophies: toSortedMapStats(mapsTrophies, 8),
    topBrawlersRanked: toBrawlerUsage(rankedBrawlers, 8),
    topBrawlersTrophies: toBrawlerUsage(trophyBrawlers, 8),
    rankedBans: [...rankedBans.values()].sort((a, b) => b.bans - a.bans).slice(0, 8)
  };
}

export function estimatePlaytimeMinutes(victories: number): number {
  return Number((Math.max(victories, 0) * 3.5).toFixed(2));
}

export function estimatePlayerPlaytime(player: Player): number {
  const victories3v3 = player["3vs3Victories"] ?? 0;
  const solo = player.soloVictories ?? 0;
  const duo = player.duoVictories ?? 0;
  const minutes = estimatePlaytimeMinutes(victories3v3 + solo + duo);
  return Number((minutes / 60).toFixed(2));
}

export function estimateAccountValue(player: Player): number {
  const brawlers = player.brawlers ?? [];
  const power11Count = brawlers.filter((brawler) => (brawler.power ?? 0) >= 11).length;
  return brawlers.length * 170 + power11Count * 50 + brawlers.length * 80;
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

function normalizeLookupKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function sanitizeRankedScore(value: number | null): number | null {
  if (value === null) return null;
  if (value <= 0 || value > MAX_REASONABLE_RANKED_SCORE) return null;
  return value;
}

function collectNumericForKeys(source: Record<string, unknown>, allowedKeys: Set<string>): number[] {
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
        const parsed = sanitizeRankedScore(asNumber(value));
        if (parsed !== null) {
          values.push(parsed);
        }
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return values;
}

function collectTierFloorsForKeys(source: Record<string, unknown>, allowedKeys: Set<string>): number[] {
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
        const tierFloor = rankTierFloorFromLabel(value);
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

function readCurrentRankedElo(source: Record<string, unknown>): number {
  const candidates = collectNumericForKeys(source, CURRENT_RANKED_KEYS);
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

function looksMasterLike(source: Record<string, unknown>): boolean {
  const tierCandidates = collectTierFloorsForKeys(source, RANKED_TIER_LABEL_KEYS);
  return tierCandidates.some((candidate) => candidate >= 8250);
}

function readHighestRankedElo(source: Record<string, unknown>): number {
  const direct = collectNumericForKeys(source, PEAK_RANKED_KEYS);
  const tierFloors = collectTierFloorsForKeys(source, RANKED_TIER_LABEL_KEYS);
  const candidates = [...direct, ...tierFloors];
  if (candidates.length === 0) return 0;
  return Math.max(...candidates);
}

export function extractRankedElo(player: Player, options: ExtractRankedEloOptions = {}): number {
  const source = player as unknown as Record<string, unknown>;
  const currentElo = extractCurrentRankedElo(player);

  if (currentElo > 0) {
    return currentElo;
  }

  if (looksMasterLike(source)) {
    const masterFallback = readHighestRankedElo(source);
    if (masterFallback > 0) {
      return masterFallback;
    }
  }

  const genericFallback = readHighestRankedElo(source);
  if (genericFallback > 0) {
    return genericFallback;
  }

  const dbFallback = asNumber(options.fallbackFromDb);
  if (dbFallback !== null && dbFallback > 0) {
    return dbFallback;
  }

  const embeddedDbCandidates = [
    source.lastRankedElo,
    source.last_ranked_elo,
    source.previousRankedElo,
    source.previous_ranked_elo
  ];
  for (const candidate of embeddedDbCandidates) {
    const parsed = asNumber(candidate);
    if (parsed !== null && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

export function extractCurrentRankedElo(player: Player): number {
  const source = player as unknown as Record<string, unknown>;
  return readCurrentRankedElo(source);
}

function brawlerName(name: BrawlerStat["name"], fallbackId: number): string {
  if (!name) return `Brawler #${fallbackId}`;
  if (typeof name === "string") return name;
  return Object.values(name)[0] ?? `Brawler #${fallbackId}`;
}

export function topPlayedBrawlers(brawlers: BrawlerStat[], limit = 10): PlayedBrawler[] {
  return [...brawlers]
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, limit)
    .map((brawler) => ({
      id: brawler.id,
      name: brawlerName(brawler.name, brawler.id),
      trophies: brawler.trophies,
      highestTrophies: brawler.highestTrophies,
      rank: brawler.rank,
      power: brawler.power,
      prestige: Math.max(0, brawler.highestTrophies - brawler.trophies),
      gamesEstimate: Math.round(brawler.trophies / 8)
    }));
}
