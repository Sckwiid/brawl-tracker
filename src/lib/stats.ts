import { BattleItem } from "@/types/brawl";
import { PlayerHistoryPoint } from "@/types/history";
import { modeOfBattle, normalizeTag } from "@/lib/utils";

export interface WinrateSummary {
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  winrate: number;
  byMode: Record<string, { wins: number; losses: number; matches: number }>;
}

export function computeWinrate(battles: BattleItem[], playerTag: string, limit = 25): WinrateSummary {
  const result: WinrateSummary = {
    wins: 0,
    losses: 0,
    draws: 0,
    matches: 0,
    winrate: 0,
    byMode: {}
  };

  const normalized = normalizeTag(playerTag);
  const list = battles.slice(0, limit);

  for (const item of list) {
    const mode = modeOfBattle(item);
    if (!result.byMode[mode]) {
      result.byMode[mode] = { wins: 0, losses: 0, matches: 0 };
    }

    const battle = item.battle ?? {};
    const value = String(battle.result ?? "").toLowerCase();
    let outcome: "win" | "loss" | "draw" | null = null;

    if (value.includes("victory") || value.includes("win")) {
      outcome = "win";
    } else if (value.includes("defeat") || value.includes("lose") || value.includes("loss")) {
      outcome = "loss";
    } else if (value.includes("draw")) {
      outcome = "draw";
    } else if (typeof battle.rank === "number") {
      outcome = battle.rank === 1 ? "win" : "loss";
    }

    // Fallback: some log payloads expose winner by team; this case is optional.
    if (!outcome && Array.isArray((battle as { teams?: unknown }).teams)) {
      const teams = (battle as { teams: Array<{ players?: Array<{ tag?: string }>; isWinner?: boolean }> }).teams;
      for (const team of teams) {
        if (team.players?.some((p) => normalizeTag(p.tag ?? "") === normalized)) {
          if (typeof team.isWinner === "boolean") {
            outcome = team.isWinner ? "win" : "loss";
          }
          break;
        }
      }
    }

    if (!outcome) {
      continue;
    }

    result.matches += 1;
    result.byMode[mode].matches += 1;

    if (outcome === "win") {
      result.wins += 1;
      result.byMode[mode].wins += 1;
    } else if (outcome === "loss") {
      result.losses += 1;
      result.byMode[mode].losses += 1;
    } else {
      result.draws += 1;
    }
  }

  result.winrate = result.matches > 0 ? Number(((result.wins / result.matches) * 100).toFixed(1)) : 0;
  return result;
}

export function gradeFromTrophies(trophies: number): string {
  if (trophies >= 70000) return "Master";
  if (trophies >= 55000) return "Diamond";
  if (trophies >= 40000) return "Gold";
  if (trophies >= 25000) return "Silver";
  return "Bronze";
}

export function buildClubTimeline(history: PlayerHistoryPoint[]): string[] {
  const timeline: string[] = [];
  const seen = new Set<string>();

  for (const point of history) {
    const club = point.club_name?.trim() || "Sans club";
    if (!seen.has(club)) {
      seen.add(club);
      timeline.push(club);
    }
  }
  return timeline;
}
