"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { outlineAccentClass } from "@/components/ui";

type MatchRow = {
  id: string;
  played_at: string;
  status: "in_progress" | "completed" | "terminated";
  best_of: number;
  winner_id: string | null;
  player1_id: string;
  p1: { name: string };
  p2: { name: string };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ m }: { m: MatchRow }) {
  const base = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium";
  if (m.status === "in_progress")
    return (
      <span className={`${base} bg-accent/15 text-accent`}>In progress</span>
    );
  if (m.status === "terminated")
    return (
      <span className={`${base} bg-red-400/10 text-red-300/90`}>
        Ended early
      </span>
    );
  const winner = m.winner_id === m.player1_id ? m.p1.name : m.p2.name;
  return <span className={`${base} bg-white/5 text-fg/80`}>{winner} won</span>;
}

export default function Home() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("matches")
      .select(
        `id, played_at, status, best_of, winner_id, player1_id,
        p1:players!matches_player1_id_fkey(name),
        p2:players!matches_player2_id_fkey(name)`,
      )
      .order("played_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setMatches((data ?? []) as unknown as MatchRow[]);
      });
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-8 flex flex-col items-center gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Squash Tracker</h1>
        <Link href="/match/new" className={`${outlineAccentClass} px-8`}>
          New match
        </Link>
      </header>

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        Matches
      </p>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {!matches && !error && <p className="text-sm text-muted">Loading...</p>}
      {matches?.length === 0 && (
        <p className="text-sm text-muted">No matches recorded yet.</p>
      )}

      <ul className="space-y-2">
        {matches?.map((m) => (
          <li key={m.id}>
            <Link
              href={`/match/${m.id}`}
              className="block rounded-xl border border-line bg-surface p-4 transition-colors active:border-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {m.p1.name} vs {m.p2.name}
                </span>
                <StatusBadge m={m} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {formatDate(m.played_at)} ·{" "}
                {m.best_of === 1 ? "1 game" : `Best of ${m.best_of}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
