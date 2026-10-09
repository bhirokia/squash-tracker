"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Player = { id: string; name: string };
type MatchLite = {
  player1_id: string;
  player2_id: string;
  status: "in_progress" | "completed" | "terminated";
  winner_id: string | null;
};

type Row = Player & { played: number; wins: number; losses: number };

export default function PlayersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: players, error: pErr }, { data: matches, error: mErr }] =
        await Promise.all([
          supabase.from("players").select("id, name").order("name"),
          supabase
            .from("matches")
            .select("player1_id, player2_id, status, winner_id"),
        ]);
      if (pErr || mErr) return setError((pErr ?? mErr)!.message);

      const ms = (matches ?? []) as MatchLite[];
      setRows(
        (players ?? []).map((p) => {
          const mine = ms.filter(
            (m) =>
              m.status !== "in_progress" &&
              (m.player1_id === p.id || m.player2_id === p.id),
          );
          const done = mine.filter((m) => m.status === "completed");
          const wins = done.filter((m) => m.winner_id === p.id).length;
          return {
            ...p,
            played: mine.length,
            wins,
            losses: done.length - wins,
          };
        }),
      );
    })();
  }, []);

  const shown = rows?.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 mt-2 text-xl font-semibold tracking-tight">
        Players
      </h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search players"
        className="mb-4 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none placeholder:text-muted focus:border-accent/60"
      />

      {error && <p className="text-sm text-red-300">{error}</p>}
      {!rows && !error && <p className="text-sm text-muted">Loading...</p>}
      {rows?.length === 0 && (
        <p className="text-sm text-muted">
          No players yet. They're added when you start a match.
        </p>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {shown?.map((p) => (
          <li key={p.id}>
            <Link
              href={`/players/${p.id}`}
              className="flex items-center justify-between px-4 py-3 active:bg-white/5"
            >
              <span className="font-medium">{p.name}</span>
              <span className="flex items-center gap-3 text-sm text-muted">
                <span className="tabular-nums">
                  {p.wins}–{p.losses}
                </span>
                <span className="text-xs">
                  {p.played} {p.played === 1 ? "match" : "matches"}
                </span>
                <span aria-hidden>›</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
