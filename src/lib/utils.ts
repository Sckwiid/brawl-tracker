export const SITE_VERSION = "1.1.10";

export function normalizeTag(rawTag: string): string {
  const trimmed = rawTag.trim().toUpperCase().replace(/%23/g, "").replace(/^#/, "");
  return `#${trimmed}`;
}

export function encodeTag(rawTag: string): string {
  return encodeURIComponent(normalizeTag(rawTag));
}

export function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "0";
  }
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function toBrawlerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function modeOfBattle(item: { battle?: { mode?: string }; event?: { mode?: string } }): string {
  return item.battle?.mode ?? item.event?.mode ?? "unknown";
}

export function formatRank(elo: number): string {
  const value = Number.isFinite(elo) ? Math.max(0, elo) : 0;
  if (value <= 0) return "Non Classé";

  if (value < 250) return "Bronze I";
  if (value < 500) return "Bronze II";
  if (value < 750) return "Bronze III";

  if (value < 1000) return "Argent I";
  if (value < 1250) return "Argent II";
  if (value < 1500) return "Argent III";

  if (value < 2000) return "Or I";
  if (value < 2500) return "Or II";
  if (value < 3000) return "Or III";

  if (value < 3500) return "Diamant I";
  if (value < 4000) return "Diamant II";
  if (value < 4500) return "Diamant III";

  if (value < 5000) return "Mythique I";
  if (value < 5500) return "Mythique II";
  if (value < 6000) return "Mythique III";

  if (value < 6750) return "Légendaire I";
  if (value < 7500) return "Légendaire II";
  if (value < 8250) return "Légendaire III";

  if (value < 9250) return "Masters I";
  if (value < 10250) return "Masters II";
  if (value < 11250) return "Masters III";
  return "Pro";
}
