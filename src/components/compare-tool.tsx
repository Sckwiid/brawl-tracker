"use client";

import { FormEvent, useState } from "react";

interface CompareSide {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
  rankedElo: number;
  rankedLabel: string;
  rankedWinrate25: number;
  trophyWinrate25: number;
  topRankedMap: string | null;
  topTrophyMap: string | null;
}

interface CompareResult {
  left: CompareSide;
  right: CompareSide;
  comparison: {
    favorite: {
      side: "left" | "right" | "even";
      tag: string | null;
      name: string | null;
      reasons: string[];
    };
    sharedClubs: string[];
    similarStats: boolean;
    rankedEloDiff: number;
    rankedWinrateDiff: number;
    trophyDiff: number;
    faceToFace: {
      matches: number;
      leftWins: number;
      rightWins: number;
      draws: number;
    };
  };
}

interface CompareToolProps {
  defaultLeftTag?: string;
}

function statValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

export function CompareTool({ defaultLeftTag = "" }: CompareToolProps) {
  const [left, setLeft] = useState(defaultLeftTag);
  const [right, setRight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams({ left, right }).toString();
      const response = await fetch(`/api/compare?${query}`);
      const payload = (await response.json()) as CompareResult | { error?: string };
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Erreur comparaison.");
      }
      setResult(payload as CompareResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur comparaison.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.65)]">
      <h2 className="text-xl font-semibold text-slate-900">Versus joueur</h2>
      <p className="mt-1 text-sm text-slate-600">
        Compare en direct le ranked, les trophes et les performances recentes.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={left}
          onChange={(event) => setLeft(event.target.value)}
          placeholder="#TAG_1"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-sky-300/60 focus:ring"
        />
        <input
          value={right}
          onChange={(event) => setRight(event.target.value)}
          placeholder="#TAG_2"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-sky-300/60 focus:ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-[#0f9dff] to-[#18d0a5] px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Analyse..." : "Comparer"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[result.left, result.right].map((side) => (
              <article key={side.tag} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{side.tag}</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">{side.name}</h3>
                <p className="mt-2 text-sm text-slate-700">Ranked: {side.rankedLabel} ({statValue(side.rankedElo)} ELO)</p>
                <p className="text-sm text-slate-700">WR Ranked (25): {side.rankedWinrate25.toFixed(1)}%</p>
                <p className="text-sm text-slate-700">WR Trophes (25): {side.trophyWinrate25.toFixed(1)}%</p>
                <p className="text-sm text-slate-700">Trophes: {statValue(side.trophies)} (max {statValue(side.highestTrophies)})</p>
                <p className="text-sm text-slate-700">Map ranked preferee: {side.topRankedMap ?? "N/A"}</p>
              </article>
            ))}
          </div>

          <article className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <h3 className="text-sm uppercase tracking-[0.16em] text-sky-700">Verdict</h3>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {result.comparison.favorite.side === "even"
                ? "Duel equilibre"
                : `${result.comparison.favorite.name} est favori`}
            </p>
            <p className="text-sm text-slate-700">
              Ecart ELO ranked: {statValue(result.comparison.rankedEloDiff)} | Ecart WR ranked: {result.comparison.rankedWinrateDiff.toFixed(1)}%
            </p>
            <p className="text-sm text-slate-700">
              Face-a-face recent: {result.comparison.faceToFace.matches} match(es) | {result.left.name} {result.comparison.faceToFace.leftWins} - {result.comparison.faceToFace.rightWins} {result.right.name}
            </p>
            <p className="text-sm text-slate-700">
              Clubs communs: {result.comparison.sharedClubs.length > 0 ? result.comparison.sharedClubs.join(", ") : "Aucun"}
            </p>
            {result.comparison.favorite.reasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {result.comparison.favorite.reasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
