"use client";

import { useMemo, useState } from "react";

const STORAGE_KEY = "brawstar_saved_profiles_v1";

interface SaveProfileButtonProps {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
}

interface SavedProfile {
  tag: string;
  name: string;
  trophies: number;
  highestTrophies: number;
  savedAt: string;
}

function loadProfiles(): SavedProfile[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as SavedProfile[]) : [];
  } catch {
    return [];
  }
}

export function SaveProfileButton(props: SaveProfileButtonProps) {
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const payload = useMemo<SavedProfile>(
    () => ({
      ...props,
      savedAt: new Date().toISOString()
    }),
    [props]
  );

  function handleSave() {
    const existing = loadProfiles();
    const withoutCurrent = existing.filter((profile) => profile.tag !== payload.tag);
    const next = [payload, ...withoutCurrent].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1400);
  }

  return (
    <button
      type="button"
      onClick={handleSave}
      className="rounded-xl border border-neon-lime/60 bg-neon-lime/15 px-4 py-2 text-sm font-semibold text-neon-lime transition hover:bg-neon-lime/25"
    >
      {status === "saved" ? "Profil sauvegardé" : "Sauvegarder mon profil"}
    </button>
  );
}
