import { BattleItem, BrawlerStat, Player } from "@/types/brawl";
import { modeOfBattle } from "@/lib/utils";

function nameOfBrawler(brawler: BrawlerStat): string {
  if (!brawler.name) return `Brawler #${brawler.id}`;
  if (typeof brawler.name === "string") return brawler.name;
  return Object.values(brawler.name)[0] ?? `Brawler #${brawler.id}`;
}

function averagePower(brawlers: BrawlerStat[]): number {
  if (brawlers.length === 0) return 0;
  const total = brawlers.reduce((acc, current) => acc + (current.power ?? 0), 0);
  return total / brawlers.length;
}

function topGapBrawler(brawlers: BrawlerStat[]): BrawlerStat | null {
  if (brawlers.length === 0) {
    return null;
  }
  return [...brawlers]
    .sort((a, b) => (b.highestTrophies - b.trophies) - (a.highestTrophies - a.trophies))[0] ?? null;
}

export function buildCoachTips(player: Player): string[] {
  const candidate = player as Player & { battles?: BattleItem[]; battlelog?: BattleItem[] };
  const tips: string[] = [];
  const brawlers = player.brawlers ?? [];
  const avgPower = averagePower(brawlers);
  const bestGap = topGapBrawler(brawlers);
  const recentBattles = candidate.battles ?? candidate.battlelog ?? [];

  const total3v3 = player["3vs3Victories"] ?? 0;
  const solo = player.soloVictories ?? 0;
  const duo = player.duoVictories ?? 0;
  const modeStats = new Map<string, { wins: number; losses: number }>();
  for (const item of recentBattles.slice(0, 25)) {
    const mode = modeOfBattle(item);
    const result = String(item.battle?.result ?? "").toLowerCase();
    const stat = modeStats.get(mode) ?? { wins: 0, losses: 0 };
    if (result.includes("victory") || result.includes("win")) {
      stat.wins += 1;
    } else if (result.includes("defeat") || result.includes("loss") || result.includes("lose")) {
      stat.losses += 1;
    }
    modeStats.set(mode, stat);
  }

  let weakestMode: string | null = null;
  let weakestRate = 101;
  for (const [mode, stat] of modeStats.entries()) {
    const matches = stat.wins + stat.losses;
    if (matches < 3) continue;
    const rate = (stat.wins / matches) * 100;
    if (rate < weakestRate) {
      weakestRate = rate;
      weakestMode = mode;
    }
  }

  if (weakestMode) {
    tips.push(
      `Ton mode le moins rentable est ${weakestMode} (${weakestRate.toFixed(0)}% WR): révise tes drafts et ton placement sur ce mode en priorité.`
    );
  } else if (total3v3 < solo + duo) {
    tips.push(
      "Tu as plus de victoires en solo/duo qu'en 3v3: ajoute des sessions en équipe pour progresser en macro et objectifs."
    );
  } else {
    tips.push("Ton volume 3v3 est solide: spécialise-toi sur 2 modes principaux pour monter plus vite ton winrate global.");
  }

  if (avgPower < 9) {
    tips.push(`Ta puissance moyenne est de ${avgPower.toFixed(1)}: monte d'abord 8 brawlers à Power 10+ pour stabiliser tes résultats.`);
  } else {
    tips.push(`Ta puissance moyenne est ${avgPower.toFixed(1)}: travaille surtout le positionnement et le timing de gadget pour convertir plus de parties.`);
  }

  if (bestGap && bestGap.highestTrophies - bestGap.trophies >= 100) {
    tips.push(
      `Tu as perdu du terrain sur ${nameOfBrawler(bestGap)}: concentre 15-20 parties dessus pour récupérer ce pic de trophées.`
    );
  } else {
    tips.push("Tes brawlers sont stables: pour passer un cap, cible les compos meta et évite de changer de brawler toutes les 2 parties.");
  }

  return tips.slice(0, 3);
}
