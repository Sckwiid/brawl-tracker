export interface ProPlayerSeed {
  handle: string;
  tag: string;
  team: string;
  matcherinoUrl: string;
  earningsUsd: number;
}

export const PRO_PLAYERS: ProPlayerSeed[] = [
  {
    handle: "Cori",
    tag: "#8GQ8UGL",
    team: "Europe Elite",
    matcherinoUrl: "https://matcherino.com/",
    earningsUsd: 52000
  },
  {
    handle: "Moya",
    tag: "#2PPV9R2Y",
    team: "NA Nova",
    matcherinoUrl: "https://matcherino.com/",
    earningsUsd: 48750
  },
  {
    handle: "Sitetampo",
    tag: "#20L8RC0V",
    team: "LATAM Pulse",
    matcherinoUrl: "https://matcherino.com/",
    earningsUsd: 44100
  }
];
