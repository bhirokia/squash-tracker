"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Rally } from "@/lib/score";
import {
  computePlayerStats,
  OUTCOME_LABELS,
  PlayerMatch,
  Row,
  SHOT_LABELS,
  shotLabel,
  pct,
} from "@/lib/playerStats";
import CourtHeatmap from "@/components/CourtHeatmap";
import { Chip, SectionLabel } from "@/components/ui";

// Supabase returns at most 1000 rows per request, so page through rallies.
async function fetchRallies(matchIds: string[]) {
  const all: Rally[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("rallies")
      .select("*")
      .in("match_id", matchIds)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...((data ?? []) as Rally[]));
    if (!data || data.length < PAGE) return all;
  }
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] tabular-nums text-muted">{sub}</p>}
    </div>
  );
}

function Bars({
  rows,
  label,
  tone = "accent",
  empty = "Nothing recorded yet",
}: {
  rows: Row[];
  label: (key: string) => string;
  tone?: "accent" | "red";
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  const bar = tone === "red" ? "bg-red-400/50" : "bg-accent/70";
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-fg/90">{label(r.key)}</span>
            <span className="tabular-nums text-muted">
              {r.count} · <span className="text-fg/80">{Math.round(r.pct * 100)}%</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type LossView = "all" | "errors" | "unforced" | "beaten";

export default function PlayerView({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const [matches, setMatches] = useState<PlayerMatch[] | null>(null);
  const [rallies, setRallies] = useState<Rally[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lossView, setLossView] = useState<LossView>("all");

  useEffect(() => {
    (async () => {
      try {
        const { data: p, error: pErr } = await supabase.from("players").select("name").eq("id", id).single();
        if (pErr) throw pErr;
        setName(p.name);

        const { data: m, error: mErr } = await supabase
          .from("matches")
          .select(`id, played_at, status, best_of, player1_id, player2_id, winner_id,
            p1:players!matches_player1_id_fkey(name),
            p2:players!matches_player2_id_fkey(name)`)
          .or(`player1_id.eq.${id},player2_id.eq.${id}`);
        if (mErr) throw mErr;
        const ms = (m ?? []) as unknown as PlayerMatch[];

        setRallies(ms.length ? await fetchRallies(ms.map((x) => x.id)) : []);
        setMatches(ms);
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      }
    })();
  }, [id]);

  const s = useMemo(() => (matches ? computePlayerStats(id, matches, rallies) : null), [id, matches, rallies]);

  if (error) return <main className="p-4 text-sm text-red-300">{error}</main>;
  if (!s || !name) return <main className="p-4 text-sm text-muted">Loading...</main>;

  const totalPoints = s.pointsWon + s.pointsLost;
  const ratio = s.unforcedErrors ? (s.winners / s.unforcedErrors).toFixed(1) : s.winners ? "∞" : "–";

  // The single shot that costs this player the most points (own errors + opponent winners with it)
  const costly = new Map<string, { errors: number; beaten: number }>();
  for (const r of s.errorsByShot) costly.set(r.key, { errors: r.count, beaten: 0 });
  for (const r of s.beatenByShot) {
    const c = costly.get(r.key) ?? { errors: 0, beaten: 0 };
    c.beaten = r.count;
    costly.set(r.key, c);
  }
  const worst = [...costly.entries()].sort(
    (a, b) => b[1].errors + b[1].beaten - (a[1].errors + a[1].beaten)
  )[0];
  const best = s.winnersByShot[0];

  const lossRows =
    lossView === "all" ? s.lostByShot
    : lossView === "errors" ? s.errorsByShot
    : lossView === "unforced" ? s.unforcedByShot
    : s.beatenByShot;

  const lossCaption: Record<LossView, string> = {
    all: "Every point lost where a shot was recorded: their own errors plus opponent winners.",
    errors: "Shots they were attempting when they made an error (forced or unforced).",
    unforced: "Shots they were attempting when they made an unforced error.",
    beaten: "Opponent shots that beat them for a winner.",
  };

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pb-16 pt-6">
      <div>
        <Link href="/players" className="text-sm text-muted">← Players</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name}</h1>
        <p className="text-sm text-muted">
          {s.matchesPlayed} {s.matchesPlayed === 1 ? "match" : "matches"} · {s.matchWins}–{s.matchLosses}
          {s.endedEarly > 0 && ` · ${s.endedEarly} ended early`}
        </p>
      </div>

      {totalPoints === 0 ? (
        <Card>
          <p className="text-sm text-muted">No rallies logged for {name} yet.</p>
        </Card>
      ) : (
        <>
          {/* Headline numbers */}
          <section className="grid grid-cols-3 gap-2">
            <Tile label="Points won" value={pct(s.pointsWon, totalPoints)} sub={`${s.pointsWon} of ${totalPoints}`} />
            <Tile label="Winners" value={String(s.winners)} sub={`${pct(s.winners, s.pointsWon)} of pts won`} />
            <Tile label="Unforced" value={String(s.unforcedErrors)} sub={`${pct(s.unforcedErrors, s.pointsLost)} of pts lost`} />
            <Tile label="Win : UE" value={ratio} sub="winners per error" />
            <Tile label="Games" value={`${s.gamesWon}–${s.gamesLost}`} sub={pct(s.gamesWon, s.gamesWon + s.gamesLost)} />
            <Tile
              label="At 9-all+"
              value={pct(s.pressure.won, s.pressure.won + s.pressure.lost)}
              sub={`${s.pressure.won}–${s.pressure.lost} pts`}
            />
          </section>

          {(best || worst) && (
            <Card className="space-y-2 text-sm">
              {best && (
                <p>
                  <span className="text-muted">Best shot · </span>
                  <span className="text-accent">{SHOT_LABELS[best.key] ?? best.key}</span>
                  <span className="text-muted"> — {Math.round(best.pct * 100)}% of winners</span>
                </p>
              )}
              {worst && (
                <p>
                  <span className="text-muted">Most costly · </span>
                  <span className="text-red-300">{SHOT_LABELS[worst[0]] ?? worst[0]}</span>
                  <span className="text-muted">
                    {" "}— {worst[1].errors + worst[1].beaten} points lost ({worst[1].errors} own errors,{" "}
                    {worst[1].beaten} opponent winners)
                  </span>
                </p>
              )}
            </Card>
          )}

          {/* How points are won and lost */}
          <section>
            <SectionLabel>How points are won</SectionLabel>
            <Card>
              <Bars
                rows={s.wonBy}
                label={(k) => (k === "winner" ? "Their winners" : k.includes("error") ? `Opponent ${OUTCOME_LABELS[k].toLowerCase()}` : OUTCOME_LABELS[k] ?? k)}
              />
            </Card>
          </section>

          <section>
            <SectionLabel>How points are lost</SectionLabel>
            <Card>
              <Bars
                tone="red"
                rows={s.lostBy}
                label={(k) => (k === "winner" ? "Opponent winners" : k.includes("error") ? `Their ${OUTCOME_LABELS[k].toLowerCase()}` : `${OUTCOME_LABELS[k] ?? k} against`)}
              />
            </Card>
          </section>

          {/* Winning shots */}
          <section>
            <SectionLabel>Winners by shot</SectionLabel>
            <Card>
              <Bars rows={s.winnersByShot} label={shotLabel} empty="No winning shots recorded yet" />
              <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                Volleys: {s.volleyWinners} of {s.winners} winners ({pct(s.volleyWinners, s.winners)})
                {s.untagged.winnerShot > 0 && ` · ${s.untagged.winnerShot} winners with no shot recorded`}
              </p>
            </Card>
          </section>

          {/* Losing shots */}
          <section>
            <SectionLabel>Points lost by shot</SectionLabel>
            <div className="mb-2 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["errors", "Their errors"],
                  ["unforced", "Unforced only"],
                  ["beaten", "Opponent winners"],
                ] as [LossView, string][]
              ).map(([v, l]) => (
                <Chip key={v} active={lossView === v} onClick={() => setLossView(v)}>
                  {l}
                </Chip>
              ))}
            </div>
            <Card>
              <p className="mb-3 text-xs text-muted">{lossCaption[lossView]}</p>
              <Bars tone="red" rows={lossRows} label={shotLabel} />
            </Card>
          </section>

          {/* Shot efficiency */}
          {s.shotEfficiency.length > 0 && (
            <section>
              <SectionLabel>Shot efficiency</SectionLabel>
              <Card className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-2 font-medium">Shot</th>
                      <th className="px-2 py-2 text-right font-medium">Winners</th>
                      <th className="px-2 py-2 text-right font-medium">Errors</th>
                      <th className="px-4 py-2 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line border-t border-line">
                    {s.shotEfficiency.map((e) => (
                      <tr key={e.shot}>
                        <td className="px-4 py-2 text-fg/90">{SHOT_LABELS[e.shot] ?? e.shot}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{e.winners}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{e.errors}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium tabular-nums ${
                            e.net > 0 ? "text-accent" : e.net < 0 ? "text-red-300" : "text-muted"
                          }`}
                        >
                          {e.net > 0 ? `+${e.net}` : e.net}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <p className="mt-1.5 text-[11px] text-muted">
                Winners hit with each shot minus errors made attempting it.
              </p>
            </section>
          )}

          {/* Court maps */}
          <section>
            <SectionLabel>Winners on court</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <CourtHeatmap title="Hit from" counts={s.winnersFrom.counts} total={s.winnersFrom.total} />
              <CourtHeatmap title="Landed in" counts={s.winnersLanded.counts} total={s.winnersLanded.total} />
            </div>
          </section>

          <section>
            <SectionLabel>Errors on court</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <CourtHeatmap title="Hit from" tone="red" counts={s.errorsFrom.counts} total={s.errorsFrom.total} />
              <p className="self-center text-xs leading-relaxed text-muted">
                Where {name} was standing when they made an error. Compare with where their winners come from to
                see which parts of the court they're comfortable attacking from.
              </p>
            </div>
          </section>

          {/* Head to head */}
          {s.headToHead.length > 0 && (
            <section>
              <SectionLabel>Head to head</SectionLabel>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
                {s.headToHead.map((h) => (
                  <li key={h.opponent} className="flex justify-between px-4 py-2.5">
                    <span>vs {h.opponent}</span>
                    <span className="tabular-nums text-muted">
                      {h.wins}–{h.losses}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Match history */}
      {s.matches.length > 0 && (
        <section>
          <SectionLabel>Matches</SectionLabel>
          <ul className="space-y-2">
            {s.matches.map((m) => (
              <li key={m.match.id}>
                <Link
                  href={`/match/${m.match.id}`}
                  className="block rounded-xl border border-line bg-surface p-3 transition-colors active:border-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">vs {m.opponent}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        m.result === "W"
                          ? "bg-accent/15 text-accent"
                          : m.result === "L"
                          ? "bg-white/5 text-fg/70"
                          : m.result === "Ended early"
                          ? "bg-red-400/10 text-red-300/90"
                          : "bg-white/5 text-muted"
                      }`}
                    >
                      {m.result === "W" ? "Won" : m.result === "L" ? "Lost" : m.result}
                    </span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-muted">
                    {formatDate(m.match.played_at)} · {m.gamesFor}–{m.gamesAgainst}
                    {m.gameScores.length > 0 && ` · ${m.gameScores.join("  ")}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
