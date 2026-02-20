import { NextResponse } from "next/server";

import { buildCoachTips } from "@/lib/coach";
import { Player } from "@/types/brawl";

function toPlayer(value: unknown): Player {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const brawlers = Array.isArray(source.brawlers) ? source.brawlers : [];

  return {
    tag: String(source.tag ?? "#UNKNOWN"),
    name: String(source.name ?? "Unknown Player"),
    trophies: Number(source.trophies ?? 0),
    highestTrophies: Number(source.highestTrophies ?? source.trophies ?? 0),
    "3vs3Victories": Number(source["3vs3Victories"] ?? 0),
    soloVictories: Number(source.soloVictories ?? 0),
    duoVictories: Number(source.duoVictories ?? 0),
    club: source.club && typeof source.club === "object" ? (source.club as Player["club"]) : undefined,
    icon: source.icon && typeof source.icon === "object" ? (source.icon as Player["icon"]) : undefined,
    brawlers: brawlers as Player["brawlers"]
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { player?: unknown };
    if (!body.player) {
      return NextResponse.json({ error: "Le JSON joueur est requis." }, { status: 400 });
    }
    const normalizedPlayer = toPlayer(body.player) as Player & { battles?: unknown; battlelog?: unknown };
    if (body.player && typeof body.player === "object") {
      const source = body.player as Record<string, unknown>;
      if (Array.isArray(source.battles)) normalizedPlayer.battles = source.battles;
      if (Array.isArray(source.battlelog)) normalizedPlayer.battlelog = source.battlelog;
    }
    const tips = buildCoachTips(normalizedPlayer).slice(0, 3);
    return NextResponse.json({
      model: "simulated-coach-v1",
      tips
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analyse impossible"
      },
      { status: 500 }
    );
  }
}
