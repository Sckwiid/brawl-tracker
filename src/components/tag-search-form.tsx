"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizeTag } from "@/lib/utils";

interface TagSearchFormProps {
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

interface HistoryEntry {
  tag: string;
  name: string | null;
}

const RECENT_KEY = "brawstar_recent_tags_v2";
const SESSION_KEY = "brawstar_search_session_v1";

function randomSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "");
  }
  return `sess_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

function dedupe(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const entry of entries) {
    const normalized = normalizeTag(entry.tag);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({
      tag: normalized,
      name: entry.name ?? null
    });
    if (out.length >= 8) break;
  }
  return out;
}

function parseLocal(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const entries = parsed
      .map((item): HistoryEntry | null => {
        if (typeof item === "string") return { tag: item, name: null };
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        if (typeof record.tag !== "string") return null;
        return {
          tag: record.tag,
          name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : null
        };
      })
      .filter((item): item is HistoryEntry => item !== null);
    return dedupe(entries);
  } catch {
    return [];
  }
}

export function TagSearchForm({ placeholder = "#PLAYER", defaultValue = "", className }: TagSearchFormProps) {
  const router = useRouter();
  const [tag, setTag] = useState(defaultValue);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const historyMap = useMemo(() => new Map(history.map((item) => [item.tag, item])), [history]);

  useEffect(() => {
    const local = parseLocal(localStorage.getItem(RECENT_KEY));
    setHistory(local);

    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = randomSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);

    void fetch(`/api/search-history?sessionId=${encodeURIComponent(sid)}`)
      .then(async (response) => {
        if (!response.ok) return [] as HistoryEntry[];
        const payload = (await response.json()) as { items?: Array<{ tag?: string; name?: string | null }> };
        return (payload.items ?? [])
          .map((item) => {
            if (!item.tag) return null;
            return {
              tag: item.tag,
              name: item.name ?? null
            };
          })
          .filter((item): item is HistoryEntry => item !== null);
      })
      .then((remote) => {
        if (remote.length === 0) return;
        const merged = dedupe([...remote, ...local]);
        setHistory(merged);
        localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
      })
      .catch(() => {
        // Ignore remote failure and keep local history only.
      });
  }, []);

  function persistLocal(next: HistoryEntry[]) {
    const merged = dedupe(next);
    setHistory(merged);
    localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
  }

  function remember(nextTag: string, playerName: string | null = null) {
    const entry = {
      tag: normalizeTag(nextTag),
      name: playerName
    };
    const existing = historyMap.get(entry.tag);
    const mergedEntry = {
      tag: entry.tag,
      name: playerName ?? existing?.name ?? null
    };
    const updated = dedupe([mergedEntry, ...history]);
    persistLocal(updated);

    if (sessionId) {
      void fetch("/api/search-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          tag: entry.tag,
          playerName: mergedEntry.name
        })
      }).catch(() => {
        // Keep local history even if remote persistence fails.
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tag.trim()) return;
    const normalizedRaw = tag.replace("#", "").trim().toUpperCase();
    if (!normalizedRaw) return;
    const cleanTag = normalizeTag(normalizedRaw);
    remember(cleanTag);
    router.push(`/player/${encodeURIComponent(cleanTag)}`);
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={tag}
          onChange={(event) => setTag(event.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 text-base text-slate-900 outline-none ring-sky-300/70 transition focus:border-sky-400 focus:ring"
          placeholder={placeholder}
          autoComplete="off"
          aria-label="Tag Brawl Stars"
        />
        <button
          type="submit"
          className="rounded-2xl bg-gradient-to-r from-[#0f9dff] to-[#18d0a5] px-5 py-3 font-semibold text-white transition hover:brightness-105"
        >
          Rechercher
        </button>
      </div>

      {history.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Historique</span>
          {history.map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => {
                remember(item.tag, item.name);
                setTag(item.tag);
                router.push(`/player/${encodeURIComponent(item.tag)}`);
              }}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:text-sky-600"
            >
              {item.name ? `${item.name} (${item.tag})` : item.tag}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
