"use client";

import { FormEvent, useState } from "react";

interface CoachResponse {
  tips: string[];
}

export function CoachAnalyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const parsed = JSON.parse(input);
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ player: parsed })
      });
      const payload = (await response.json()) as CoachResponse | { error?: string };
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Analyse impossible.");
      }
      setTips((payload as CoachResponse).tips ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "JSON invalide.");
      setTips([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-surface-800/80 p-6">
      <h1 className="text-2xl font-bold text-white">IA Coach</h1>
      <p className="mt-2 text-sm text-slate-300">Colle le JSON joueur Brawl Stars et récupère 3 axes d'amélioration.</p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder='{"tag":"#XXXX","trophies":...}'
          rows={12}
          className="w-full rounded-xl border border-cyan-500/40 bg-surface-900 p-4 font-mono text-sm text-slate-100 outline-none ring-cyan-300/60 focus:ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-2 font-semibold text-surface-900 disabled:opacity-60"
        >
          {loading ? "Analyse..." : "Analyser mon JSON"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {tips.length > 0 ? (
        <ol className="mt-4 space-y-2 text-sm text-slate-100">
          {tips.map((tip) => (
            <li key={tip} className="rounded-lg border border-slate-700 bg-surface-900 p-3">
              {tip}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
