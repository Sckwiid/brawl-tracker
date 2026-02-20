import { NextRequest, NextResponse } from "next/server";

import { BattleItem } from "@/types/brawl";
import { BrawlApiError, getBattlelog, getPlayer } from "@/lib/brawlApi";
import { computeBattlelogAnalytics, extractRankedElo } from "@/lib/metrics";
import { getSupabaseAdmin, HistoryRow } from "@/lib/supabase";
import { formatRank, normalizeTag } from "@/lib/utils";

type Side = "left" | "right" | "even";

function normalizeResult(result: unknown): "win" | "loss" | "draw" | null {
  const value = String(result ?? "").toLowerCase();
  if (value.includes("victory") || value.includes("win")) return "win";
  if (value.includes("defeat") || value.includes("loss") || value.includes("lose")) return "loss";
  if (value.includes("draw")) return "draw";
  return null;
}

function faceToFaceFromBattlelogs(leftBattles: BattleItem[], rightBattles: BattleItem[]) {
  const leftMap = new Map<string, "win" | "loss" | "draw" | null>();
  for (const item of leftBattles) {
    const key = `${item.battleTime ?? ""}|${item.event?.mode ?? ""}|${item.event?.map ?? ""}`;
    if (key.startsWith("||")) continue;
    leftMap.set(key, normalizeResult(item.battle?.result));
  }

  let matches = 0;
  let leftWins = 0;
  let rightWins = 0;
  let draws = 0;
  for (const item of rightBattles) {
    const key = `${item.battleTime ?? ""}|${item.event?.mode ?? ""}|${item.event?.map ?? ""}`;
    if (!leftMap.has(key)) continue;

    matches += 1;
    const leftResult = leftMap.get(key);
    const rightResult = normalizeResult(item.battle?.result);
    if (leftResult === "win" || rightResult === "loss") {
      leftWins += 1;
    } else if (rightResult === "win" || leftResult === "loss") {
      rightWins += 1;
    } else {
      draws += 1;
    }
  }

  return { matches, leftWins, rightWins, draws };
}

async function getHistoryForTags(leftTag: string, rightTag: string): Promise<HistoryRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("history")
    .select("*")
    .in("player_tag", [leftTag, rightTag])
    .order("snapshot_date", { ascending: false })
    .limit(240);

  if (query.error) {
    throw new Error(`Supabase history compare error: ${query.error.message}`);
  }
  return (query.data as HistoryRow[]) ?? [];
}

function sharedClubsFromHistory(history: HistoryRow[], leftTag: string, rightTag: string): string[] {
  const leftSet = new Set<string>();
  const rightSet = new Set<string>();

  for (const row of history) {
    const club = row.club_name?.trim() || row.club_tag?.trim() || "";
    if (!club) continue;
    if (row.player_tag === leftTag) leftSet.add(club);
    if (row.player_tag === rightTag) rightSet.add(club);
  }

  return [...leftSet].filter((club) => rightSet.has(club));
}

function favoriteDecision(input: {
  leftName: string;
  rightName: string;
  leftTag: string;
  rightTag: string;
  leftRankedElo: number;
  rightRankedElo: number;
  leftRankedWinrate: number;
  rightRankedWinrate: number;
  leftTrophies: number;
  rightTrophies: number;
  leftHighest: number;
  rightHighest: number;
  sharedClubs: string[];
}): { side: Side; tag: string | null; name: string | null; reasons: string[]; similarStats: boolean } {
  let leftScore = 0;
  let rightScore = 0;
  const reasons: string[] = [];

  if (input.leftRankedElo > input.rightRankedElo + 250) {
    leftScore += 3;
    reasons.push(`${input.leftName} a un avantage ranked net.`);
  } else if (input.rightRankedElo > input.leftRankedElo + 250) {
    rightScore += 3;
    reasons.push(`${input.rightName} a un avantage ranked net.`);
  }

  if (input.leftRankedWinrate > input.rightRankedWinrate + 3) {
    leftScore += 2;
    reasons.push(`${input.leftName} a un meilleur winrate recent en ranked.`);
  } else if (input.rightRankedWinrate > input.leftRankedWinrate + 3) {
    rightScore += 2;
    reasons.push(`${input.rightName} a un meilleur winrate recent en ranked.`);
  }

  if (input.leftTrophies > input.rightTrophies + 250) {
    leftScore += 1;
  } else if (input.rightTrophies > input.leftTrophies + 250) {
    rightScore += 1;
  }

  if (input.leftHighest > input.rightHighest + 500) {
    leftScore += 1;
  } else if (input.rightHighest > input.leftHighest + 500) {
    rightScore += 1;
  }

  if (input.sharedClubs.length > 0) {
    reasons.push(`Historique commun: ${input.sharedClubs.join(", ")}.`);
  }

  const similarStats =
    Math.abs(input.leftRankedElo - input.rightRankedElo) <= 200 &&
    Math.abs(input.leftRankedWinrate - input.rightRankedWinrate) <= 2.5;

  if (similarStats) {
    reasons.push("Niveau statistique tres proche sur l'echantillon recent.");
  }

  if (leftScore === rightScore) {
    return {
      side: "even",
      tag: null,
      name: null,
      reasons,
      similarStats
    };
  }

  if (leftScore > rightScore) {
    return {
      side: "left",
      tag: input.leftTag,
      name: input.leftName,
      reasons,
      similarStats
    };
  }

  return {
    side: "right",
    tag: input.rightTag,
    name: input.rightName,
    reasons,
    similarStats
  };
}

export async function GET(request: NextRequest) {
  const leftRaw = request.nextUrl.searchParams.get("left");
  const rightRaw = request.nextUrl.searchParams.get("right");
  if (!leftRaw || !rightRaw) {
    return NextResponse.json({ error: "Parametres left et right requis." }, { status: 400 });
  }

  const leftTag = normalizeTag(leftRaw);
  const rightTag = normalizeTag(rightRaw);

  try {
    const [leftPlayer, rightPlayer, leftBattles, rightBattles, history] = await Promise.all([
      getPlayer(leftTag),
      getPlayer(rightTag),
      getBattlelog(leftTag, 60),
      getBattlelog(rightTag, 60),
      getHistoryForTags(leftTag, rightTag)
    ]);

    const leftAnalytics = computeBattlelogAnalytics(leftBattles, leftTag, 60);
    const rightAnalytics = computeBattlelogAnalytics(rightBattles, rightTag, 60);

    const leftRankedElo = extractRankedElo(leftPlayer);
    const rightRankedElo = extractRankedElo(rightPlayer);

    const leftRankedWinrate = leftAnalytics.rankedWinrate25 ?? 0;
    const rightRankedWinrate = rightAnalytics.rankedWinrate25 ?? 0;
    const leftTrophyWinrate = leftAnalytics.trophyWinrate25 ?? 0;
    const rightTrophyWinrate = rightAnalytics.trophyWinrate25 ?? 0;

    const sharedClubsSet = new Set(sharedClubsFromHistory(history, leftTag, rightTag));
    const leftCurrentClub = leftPlayer.club?.name?.trim() || leftPlayer.club?.tag?.trim() || "";
    const rightCurrentClub = rightPlayer.club?.name?.trim() || rightPlayer.club?.tag?.trim() || "";
    if (leftCurrentClub && rightCurrentClub && leftCurrentClub === rightCurrentClub) {
      sharedClubsSet.add(leftCurrentClub);
    }
    const sharedClubs = [...sharedClubsSet];

    const faceToFace = faceToFaceFromBattlelogs(leftBattles, rightBattles);

    const favorite = favoriteDecision({
      leftName: leftPlayer.name,
      rightName: rightPlayer.name,
      leftTag,
      rightTag,
      leftRankedElo,
      rightRankedElo,
      leftRankedWinrate,
      rightRankedWinrate,
      leftTrophies: leftPlayer.trophies,
      rightTrophies: rightPlayer.trophies,
      leftHighest: leftPlayer.highestTrophies,
      rightHighest: rightPlayer.highestTrophies,
      sharedClubs
    });

    return NextResponse.json({
      left: {
        tag: leftPlayer.tag,
        name: leftPlayer.name,
        trophies: leftPlayer.trophies,
        highestTrophies: leftPlayer.highestTrophies,
        rankedElo: leftRankedElo,
        rankedLabel: formatRank(leftRankedElo),
        rankedWinrate25: leftRankedWinrate,
        trophyWinrate25: leftTrophyWinrate,
        topRankedMap: leftAnalytics.mapsRanked[0]?.map ?? null,
        topTrophyMap: leftAnalytics.mapsTrophies[0]?.map ?? null,
        winrate25: leftRankedWinrate > 0 ? leftRankedWinrate : leftTrophyWinrate
      },
      right: {
        tag: rightPlayer.tag,
        name: rightPlayer.name,
        trophies: rightPlayer.trophies,
        highestTrophies: rightPlayer.highestTrophies,
        rankedElo: rightRankedElo,
        rankedLabel: formatRank(rightRankedElo),
        rankedWinrate25: rightRankedWinrate,
        trophyWinrate25: rightTrophyWinrate,
        topRankedMap: rightAnalytics.mapsRanked[0]?.map ?? null,
        topTrophyMap: rightAnalytics.mapsTrophies[0]?.map ?? null,
        winrate25: rightRankedWinrate > 0 ? rightRankedWinrate : rightTrophyWinrate
      },
      comparison: {
        favorite,
        sharedClubs,
        similarStats: favorite.similarStats,
        rankedEloDiff: Math.abs(leftRankedElo - rightRankedElo),
        rankedWinrateDiff: Number(Math.abs(leftRankedWinrate - rightRankedWinrate).toFixed(2)),
        trophyDiff: Math.abs(leftPlayer.trophies - rightPlayer.trophies),
        faceToFace
      }
    });
  } catch (error) {
    if (error instanceof BrawlApiError && error.code === "PLAYER_NOT_FOUND") {
      return NextResponse.json({ error: "Un des joueurs est introuvable." }, { status: 404 });
    }
    if (error instanceof BrawlApiError && error.code === "MAINTENANCE") {
      return NextResponse.json({ error: "API Brawl Stars en maintenance." }, { status: 503 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Comparaison impossible"
      },
      { status: 500 }
    );
  }
}
