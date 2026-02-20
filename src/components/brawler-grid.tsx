import brawlersData from "@/data/brawlers.json";
import { BrawlerStat, BrawlerCatalogEntry } from "@/types/brawl";

interface BrawlerGridProps {
  brawlers: BrawlerStat[];
  catalog: BrawlerCatalogEntry[];
}

function localizedName(name: string | Record<string, string> | undefined): string | null {
  if (!name) return null;
  if (typeof name === "string") return name;
  const values = Object.values(name);
  return values[0] ?? null;
}

function resolveName(brawler: BrawlerStat, catalog: Map<number, string>): string {
  const name = localizedName(brawler.name);
  if (name) {
    return name;
  }
  return catalog.get(brawler.id) ?? `Brawler #${brawler.id}`;
}

export function BrawlerGrid({ brawlers, catalog }: BrawlerGridProps) {
  const nameById = new Map<number, string>(
    catalog.map((entry) => [entry.id, localizedName(entry.name) ?? `#${entry.id}`])
  );
  const dataset = (brawlersData as any).list as Array<{ id: number; imageUrl: string }>;
  const imageById = new Map<number, string>(
    dataset.map((entry) => [Number(entry.id), entry.imageUrl])
  );
  const defaultImage = imageById.get(16000000) ?? "https://cdn.brawlify.com/brawler/16000000.png";
  const ordered = [...brawlers].sort((a, b) => b.trophies - a.trophies);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ordered.map((brawler) => {
        const name = resolveName(brawler, nameById);
        const imgSrc = imageById.get(Number(brawler.id)) ?? defaultImage;

        return (
          <article key={brawler.id} className="rounded-xl border border-slate-700/80 bg-surface-900/70 p-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-700 bg-surface-800">
                <img
                  src={imgSrc}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallbackApplied === "1") return;
                    image.dataset.fallbackApplied = "1";
                    image.src = defaultImage;
                  }}
                />
              </div>
              <div>
                <h3 className="font-semibold text-white">{name}</h3>
                <p className="text-xs text-slate-400">Power {brawler.power} • Rank {brawler.rank}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-slate-300">Actuel: {brawler.trophies}</span>
              <span className="text-neon-lime">Max: {brawler.highestTrophies}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
