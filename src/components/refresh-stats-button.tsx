"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function RefreshStatsButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function refreshStats() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("refresh", Date.now().toString());

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={refreshStats}
      disabled={isPending}
      className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Actualisation..." : "Actualiser les stats"}
    </button>
  );
}
