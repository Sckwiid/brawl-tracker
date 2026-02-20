import { SITE_VERSION } from "@/lib/utils";

export function AffiliationBanner() {
  return (
    <aside className="fixed bottom-0 left-0 right-0 z-40 border-t border-neon-cyan/30 bg-surface-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <p className="text-slate-200">
          Soutiens le projet avec le code créateur <span className="font-bold text-neon-cyan">BRAWSTAR</span>
          <span className="ml-2 text-[10px] text-slate-400">v{SITE_VERSION}</span>
        </p>
        <a
          href="https://supercell.com/en/games/brawlstars/"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-neon-cyan/50 px-3 py-1 font-semibold text-neon-cyan hover:bg-neon-cyan/10"
        >
          Ouvrir la boutique
        </a>
      </div>
    </aside>
  );
}
