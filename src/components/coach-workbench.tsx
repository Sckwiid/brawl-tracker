"use client";

import { FormEvent, useMemo, useState } from "react";

import { normalizeTag } from "@/lib/utils";

interface PlayerApiPayload {
  player: Record<string, unknown>;
  battlelog?: unknown[];
}

export function CoachWorkbench() {
  const [tag, setTag] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [tips, setTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prettyJson = useMemo(() => {
    try {
      if (!jsonText.trim()) return "";
      const parsed = JSON.parse(jsonText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonText;
    }
  }, [jsonText]);

  async function loadFromTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalized = normalizeTag(tag);
      const response = await fetch(`/api/player/${encodeURIComponent(normalized)}`);
      const payload = (await response.json()) as PlayerApiPayload | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Chargement joueur impossible.");
      }
      setJsonText(JSON.stringify(payload, null, 2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chargement joueur impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeJson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(jsonText);
      const player = (parsed.player ?? parsed) as Record<string, unknown>;
      const battlelog = Array.isArray(parsed.battlelog) ? parsed.battlelog : [];

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          player: {
            ...player,
            battlelog
          }
        })
      });
      const payload = (await response.json()) as { tips?: string[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Analyse impossible.");
      }
      setTips((payload.tips ?? []).slice(0, 3));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "JSON invalide.");
      setTips([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={loadFromTag} className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
        <p className="mb-2 text-sm text-slate-300">1) Charger un joueur depuis son tag</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="#PLAYER"
            className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-white outline-none ring-neon-cyan/60 focus:ring"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-neon-cyan px-4 py-2 font-semibold text-surface-900 disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Importer JSON"}
          </button>
        </div>
      </form>

      <form onSubmit={analyzeJson} className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
        <p className="mb-2 text-sm text-slate-300">2) Envoi au modèle simulé (3 conseils précis)</p>
        <textarea
          value={prettyJson}
          onChange={(event) => setJsonText(event.target.value)}
          rows={14}
          className="w-full rounded-xl border border-slate-700 bg-surface-900 p-3 font-mono text-xs text-slate-100 outline-none ring-neon-cyan/60 focus:ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-3 rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-2 font-semibold text-surface-900 disabled:opacity-60"
        >
          {loading ? "Analyse..." : "Générer conseils"}
        </button>
      </form>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {tips.length > 0 ? (
        <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Conseils IA (simulation)</h2>
          <ol className="space-y-2 text-sm text-slate-200">
            {tips.map((tip) => (
              <li key={tip} className="rounded-lg border border-slate-700 bg-surface-900 p-3">
                {tip}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
