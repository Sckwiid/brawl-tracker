"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PlayerHistoryPoint } from "@/types/history";

interface HistoryChartProps {
  points: PlayerHistoryPoint[];
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function HistoryChart({ points }: HistoryChartProps) {
  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700/70 bg-surface-900/80 p-5 text-sm text-slate-300">
        Aucun snapshot en base pour ce joueur pour le moment.
      </div>
    );
  }

  const data = points.map((point) => ({
    date: formatDate(point.captured_at),
    trophies: point.trophies,
    maxTrophies: point.highest_trophies
  }));

  return (
    <div className="h-72 w-full rounded-2xl border border-slate-700/70 bg-surface-900/80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fill: "#a8b6d0", fontSize: 11 }} />
          <YAxis tick={{ fill: "#a8b6d0", fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="trophies" stroke="#39d8ff" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="maxTrophies" stroke="#98ff3f" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
