import { NextResponse } from "next/server";

import { BrawlApiError } from "@/lib/brawlApi";
import { fetchAndStorePlayerSnapshot } from "@/lib/snapshots";
import { normalizeTag } from "@/lib/utils";

interface Context {
  params: { tag: string };
}

export async function GET(_request: Request, context: Context) {
  const tag = normalizeTag(decodeURIComponent(context.params.tag));

  try {
    const bundle = await fetchAndStorePlayerSnapshot(tag);
    return NextResponse.json({
      tag,
      player: bundle.player,
      battlelog: bundle.battlelog,
      winrates25: bundle.winrates25,
      analytics: bundle.analytics,
      estimatedPlaytimeHours: bundle.estimatedPlaytimeHours,
      accountValueGems: bundle.accountValueGems,
      rankedElo: bundle.rankedElo,
      topBrawlers: bundle.topBrawlers,
      history: bundle.history,
      isProVerified: bundle.isProVerified,
      proProfile: bundle.proProfile,
      changed: bundle.changed
    });
  } catch (error) {
    if (error instanceof BrawlApiError) {
      if (error.code === "PLAYER_NOT_FOUND") {
        return NextResponse.json(
          {
            error: "Joueur introuvable."
          },
          { status: 404 }
        );
      }

      if (error.code === "MAINTENANCE") {
        return NextResponse.json(
          {
            error: "API Brawl Stars en maintenance."
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: error.message
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur interne"
      },
      { status: 500 }
    );
  }
}
