export interface PlayerRankingClub {
  name: string;
}

export interface PlayerIcon {
  id: number;
}

export interface BrawlerAccessory {
  id: number;
  name?: string | Record<string, string>;
}

export interface PlayerRanking {
  tag: string;
  name: string;
  rank: number;
  trophies: number;
  icon?: PlayerIcon;
  club?: PlayerRankingClub;
}

export interface BrawlerStat {
  id: number;
  name?: string | Record<string, string>;
  rank: number;
  power: number;
  trophies: number;
  highestTrophies: number;
  gadgets?: BrawlerAccessory[];
  starPowers?: BrawlerAccessory[];
  currentWinStreak?: number;
  maxWinStreak?: number;
}

export interface PlayerClub {
  tag?: string;
  name?: string;
}

export interface Player {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
  highestRankedTrophies?: number;
  rankedTrophies?: number;
  rankedScore?: number;
  elo?: number;
  ranked_score?: number;
  rankName?: string;
  currentRankName?: string;
  rankedTier?: string;
  currentRankedTier?: string;
  highest_ranked_trophies?: number;
  ranked_trophies?: number;
  expLevel?: number;
  "3vs3Victories"?: number;
  soloVictories?: number;
  duoVictories?: number;
  club?: PlayerClub;
  icon?: PlayerIcon;
  brawlers: BrawlerStat[];
}

export interface BattleResult {
  result?: string;
  rank?: number;
  mode?: string;
  trophyChange?: number;
  [key: string]: unknown;
}

export interface BattleEvent {
  mode?: string;
  map?: string;
  [key: string]: unknown;
}

export interface BattleItem {
  battleTime?: string;
  battle?: BattleResult;
  event?: BattleEvent;
  [key: string]: unknown;
}

export interface BrawlerCatalogEntry {
  id: number;
  name?: string | Record<string, string>;
}

export interface BrawlListResponse<T> {
  items: T[];
}
