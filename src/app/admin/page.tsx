import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getBrawlerCatalog } from "@/lib/brawlApi";
import { getMetaTierlist, upsertMetaTierEntry } from "@/lib/supabase";

const ADMIN_COOKIE = "brawstar_admin_auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Meta Tier List",
  description: "Panel admin pour gérer la table meta_tierlist.",
  alternates: {
    canonical: "/admin"
  }
};

async function loginAction(formData: FormData) {
  "use server";

  const inputPassword = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    redirect("/admin?error=missing_admin_password");
  }

  if (inputPassword !== expected) {
    redirect("/admin?error=invalid_password");
  }

  cookies().set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  redirect("/admin");
}

async function logoutAction() {
  "use server";
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin");
}

async function saveTierAction(formData: FormData) {
  "use server";

  const cookieStore = cookies();
  const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === "1";
  if (!isAuthed) {
    redirect("/admin?error=not_authenticated");
  }

  const brawlerName = String(formData.get("brawler_name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "").toUpperCase() as "S" | "A" | "B" | "C";
  const mode = String(formData.get("mode") ?? "").trim();

  if (!brawlerName || !mode || !["S", "A", "B", "C"].includes(tier)) {
    redirect("/admin?error=invalid_payload");
  }

  await upsertMetaTierEntry({
    brawlerName,
    tier,
    mode
  });

  redirect("/admin?saved=1");
}

interface AdminPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const isAuthed = cookies().get(ADMIN_COOKIE)?.value === "1";
  const error = typeof searchParams?.error === "string" ? searchParams.error : null;
  const saved = searchParams?.saved === "1";

  if (!isAuthed) {
    return (
      <section className="mx-auto max-w-md rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
        <h1 className="text-2xl font-bold text-white">Admin Login</h1>
        <p className="mt-2 text-sm text-slate-300">Accès protégé par `ADMIN_PASSWORD`.</p>
        {error ? <p className="mt-2 text-sm text-rose-300">Erreur: {error}</p> : null}
        <form action={loginAction} className="mt-4 space-y-3">
          <input
            name="password"
            type="password"
            className="w-full rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-white outline-none ring-neon-cyan/60 focus:ring"
            placeholder="Mot de passe admin"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-2 font-semibold text-surface-900"
          >
            Se connecter
          </button>
        </form>
      </section>
    );
  }

  const [catalog, currentMeta] = await Promise.all([getBrawlerCatalog().catch(() => []), getMetaTierlist().catch(() => [])]);
  const brawlerNames = [...new Set(catalog.map((entry) => (typeof entry.name === "string" ? entry.name : Object.values(entry.name ?? {})[0])))]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-title)] text-3xl text-white">Admin Meta Panel</h1>
            <p className="mt-2 text-sm text-slate-300">Assigner un Tier (S/A/B/C) à chaque brawler par mode.</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-sm text-slate-200">
              Déconnexion
            </button>
          </form>
        </div>
        {saved ? <p className="mt-3 text-sm text-neon-cyan">Tier sauvegardé.</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-5">
        <h2 className="text-lg font-bold text-white">Nouvelle affectation</h2>
        <form action={saveTierAction} className="mt-3 grid gap-3 md:grid-cols-4">
          <select
            name="brawler_name"
            className="rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-white outline-none ring-neon-cyan/60 focus:ring"
            defaultValue=""
          >
            <option value="" disabled>
              Choisir un brawler
            </option>
            {brawlerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <input
            name="mode"
            placeholder="Mode (ex: Brawl Ball)"
            className="rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-white outline-none ring-neon-cyan/60 focus:ring"
          />

          <select
            name="tier"
            defaultValue="A"
            className="rounded-xl border border-slate-700 bg-surface-900 px-3 py-2 text-white outline-none ring-neon-cyan/60 focus:ring"
          >
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-2 font-semibold text-surface-900"
          >
            Sauvegarder
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-5">
        <h2 className="text-lg font-bold text-white">Entrées actuelles</h2>
        <div className="mt-3 grid gap-2">
          {currentMeta.map((entry) => (
            <article key={`${entry.id}-${entry.mode}`} className="rounded-lg border border-slate-700 bg-surface-900 px-3 py-2 text-sm">
              <span className="font-semibold text-white">{entry.brawler_name}</span>
              <span className="mx-2 text-neon-cyan">Tier {entry.tier}</span>
              <span className="text-slate-300">Mode: {entry.mode}</span>
            </article>
          ))}
          {currentMeta.length === 0 ? <p className="text-sm text-slate-300">Aucune entrée meta en base.</p> : null}
        </div>
      </section>
    </div>
  );
}
