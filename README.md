# Brawl Tracker

Tracker Brawl Stars en Next.js + TypeScript, avec focus **ranked**, comparaison **versus**, et persistance Supabase.

## Fonctionnalites

- Home moderne avec 3 classements mis en avant:
  - top joueurs ranked,
  - top joueurs trophes,
  - top cashprize Matcherino.
- Recherche joueur par tag + historique de recherche (local + sync Supabase par session).
- Page joueur orientee ranked:
  - winrate ranked (25 derniers matchs + vue saison estimee),
  - maps les plus jouees,
  - brawlers les plus joues en ranked et en trophes,
  - brawlers les plus bannis en ranked (si presents dans les logs),
  - bloc versus pour comparer avec un autre joueur.
- Persistance Supabase:
  - snapshots joueurs,
  - historique journalier,
  - snapshots analytics (maps/brawlers/bans/winrates),
  - historique de recherche.

## Variables d'environnement

Le projet est configure pour utiliser les variables suivantes:

- `BRAWL_API_BASE_URL`
- `BRAWL_API_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Variables optionnelles:

- `NEXT_PUBLIC_SITE_URL` (defaut local)
- `BRAWLIFY_API_BASE_URL` (fallback assets/meta)

## Setup local

1. Installer les dependances

```bash
npm install
```

2. Creer le fichier local

```bash
cp .env.example .env.local
```

3. Appliquer le schema Supabase

- Ouvrir le SQL Editor Supabase.
- Executer `supabase/schema.sql`.

4. Lancer le projet

```bash
npm run dev
```

## Limites techniques (API officielle)

- L'API Brawl Stars ne fournit pas un endpoint public "cashprize Matcherino": ces donnees proviennent de la table Supabase `pro_players`.
- Le battlelog public est limite au recent, donc le mode "saison" est une **estimation** et non une statistique saison complete certifiee.
- Les bans ranked ne sont affiches que si les champs correspondants sont presents dans les payloads battlelog.
- Le leaderboard ranked global est reconstruit par proxy (fallback) quand l'API ne donne pas de classement ranked direct exploitable.

## Deploiement

- Hebergement: Vercel.
- Variables d'environnement: configurees dans Vercel Project Settings.
- Code: depot GitHub public.
