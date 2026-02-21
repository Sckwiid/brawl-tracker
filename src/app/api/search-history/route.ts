import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeTag } from "@/lib/utils";

interface SearchHistoryItem {
  tag: string;
  name: string | null;
  searchedAt: string;
}

function cleanSessionId(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (!normalized) return null;
  if (normalized.length > 80) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) return null;
  return normalized;
}

async function readLatest(sessionId: string): Promise<SearchHistoryItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const query = await supabase
    .from("search_history")
    .select("player_tag,player_name,updated_at")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (query.error) {
    throw new Error(`Supabase read search_history error: ${query.error.message}`);
  }

  return (query.data ?? []).map((row) => ({
    tag: String(row.player_tag ?? ""),
    name: typeof row.player_name === "string" ? row.player_name : null,
    searchedAt: String(row.updated_at ?? new Date().toISOString())
  }));
}

export async function GET(request: NextRequest) {
  const sessionId = cleanSessionId(request.nextUrl.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await readLatest(sessionId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({
      items: [],
      warning: error instanceof Error ? error.message : "Unable to read search history"
    });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: string;
    tag?: string;
    playerName?: string;
  } | null;

  const sessionId = cleanSessionId(body?.sessionId ?? null);
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId invalide." }, { status: 400 });
  }

  const rawTag = String(body?.tag ?? "").trim();
  if (!rawTag) {
    return NextResponse.json({ error: "tag requis." }, { status: 400 });
  }

  const tag = normalizeTag(rawTag);
  const playerName = typeof body?.playerName === "string" && body.playerName.trim() ? body.playerName.trim() : null;
  const now = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const payload = {
      session_id: sessionId,
      player_tag: tag,
      player_name: playerName,
      searched_at: now,
      updated_at: now
    };

    const upsert = await supabase.from("search_history").upsert(payload, {
      onConflict: "session_id,player_tag"
    });
    if (upsert.error) {
      return NextResponse.json({
        items: [
          {
            tag,
            name: playerName,
            searchedAt: now
          }
        ],
        warning: `Supabase upsert search_history error: ${upsert.error.message}`
      });
    }
  }

  try {
    const items = await readLatest(sessionId);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({
      items: [
        {
          tag,
          name: playerName,
          searchedAt: now
        }
      ]
    });
  }
}
