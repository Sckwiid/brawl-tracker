interface TopEarningsEntry {
  tag: string;
  displayName: string;
  team: string;
  earningsUsd: number;
  matcherinoUrl: string | null;
}

interface TopEarningsBoardProps {
  entries: TopEarningsEntry[];
}

function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function TopEarningsBoard({ entries }: TopEarningsBoardProps) {
  if (entries.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Top Cashprize Matcherino</h2>
        <p className="mt-2 text-sm text-slate-600">Aucune donnee disponible dans la table `pro_players`.</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Top Cashprize Matcherino</h2>
      <div className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <article key={`${entry.tag}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <p className="text-xs text-slate-500">#{index + 1}</p>
              <p className="font-semibold text-slate-900">{entry.displayName}</p>
              <p className="text-xs text-slate-600">
                {entry.team} | {entry.tag}
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900">{money(entry.earningsUsd)}</p>
              {entry.matcherinoUrl ? (
                <a href={entry.matcherinoUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-700 underline">
                  Matcherino
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
