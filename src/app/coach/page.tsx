import type { Metadata } from "next";

import { CoachWorkbench } from "@/components/coach-workbench";

export const metadata: Metadata = {
  title: "IA Coach Brawl Stars - Analyse JSON",
  description: "Charge un joueur, envoie son JSON à un modèle simulé et récupère 3 conseils précis.",
  alternates: {
    canonical: "/coach"
  },
  openGraph: {
    title: "IA Coach Brawl Stars - Analyse JSON",
    description: "Charge un joueur, envoie son JSON à un modèle simulé et récupère 3 conseils précis.",
    images: [
      {
        url: "https://cdn.brawlify.com/brawlers/borderless/byron.png",
        alt: "IA Coach"
      }
    ]
  }
};

export default function CoachPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
        <h1 className="font-[var(--font-title)] text-3xl text-white">IA Coach</h1>
        <p className="mt-2 text-sm text-slate-300">
          Analyse assistée des données joueur avec recommandations ciblées.
        </p>
      </section>
      <CoachWorkbench />
    </div>
  );
}
