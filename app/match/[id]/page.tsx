"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { computeScore, sortRallies, Rally } from "@/lib/score";
import CourtPicker from "@/components/CourtPicker";
import {
  Chip,
  SectionLabel,
  primaryClass,
  secondaryClass,
  dangerClass,
} from "@/components/ui";

type Match = {
  id: string;
  best_of: number;
  status: "in_progress" | "completed" | "terminated";
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  termination_reason: string | null;
  p1: { name: string };
  p2: { name: string };
};

const OUTCOMES = [
  { value: "winner", label: "Winner" },
  { value: "unforced_error", label: "Unforced error" },
  { value: "forced_error", label: "Forced error" },
  { value: "stroke", label: "Stroke" },
  { value: "no_let", label: "No let" },
];

const SHOTS = [
  { value: "drive", label: "Drive" },
  { value: "crosscourt_drive", label: "Cross drive" },
  { value: "boast", label: "Boast" },
  { value: "drop", label: "Drop" },
  { value: "crosscourt_drop", label: "Cross drop" },
  { value: "lob", label: "Lob" },
  { value: "kill", label: "Kill" },
  { value: "serve", label: "Serve" },
  { value: "other", label: "Other" },
];

const SHOT_OUTCOMES = ["winner", "unforced_error", "forced_error"];

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [rallies, setRallies] = useState<Rally[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pointWinner, setPointWinner] = useState<string | null>(null); // player id, or "let"
  const [outcome, setOutcome] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [volley, setVolley] = useState(false);
  const [fromZone, setFromZone] = useState<string | null>(null);
  const [toZone, setToZone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: m, error: mErr } = await supabase
        .from("matches")
        .select(
          `id, best_of, status, player1_id, player2_id, winner_id, termination_reason,
          p1:players!matches_player1_id_fkey(name),
          p2:players!matches_player2_id_fkey(name)`,
        )
        .eq("id", id)
        .single();
      if (mErr) return setError(mErr.message);
      setMatch(m as unknown as Match);

      const { data: r, error: rErr } = await supabase
        .from("rallies")
        .select("*")
        .eq("match_id", id);
      if (rErr) return setError(rErr.message);
      setRallies(r ?? []);
    })();
  }, [id]);

  const score = useMemo(
    () =>
      match
        ? computeScore(
            rallies,
            match.player1_id,
            match.player2_id,
            match.best_of,
          )
        : null,
    [rallies, match],
  );

  if (error && !match)
    return <main className="p-4 text-sm text-red-300">{error}</main>;
  if (!match || !score)
    return <main className="p-4 text-sm text-muted">Loading...</main>;

  const live = match.status === "in_progress";
  const isLet = pointWinner === "let";
  const hasShot = !isLet && outcome !== null && SHOT_OUTCOMES.includes(outcome);
  const canSave = isLet || (pointWinner !== null && outcome !== null);

  const name = (pid: string | null) =>
    pid === match.player1_id
      ? match.p1.name
      : pid === match.player2_id
        ? match.p2.name
        : "";
  const opponent = (pid: string) =>
    pid === match.player1_id ? match.player2_id : match.player1_id;

  function resetForm() {
    setPointWinner(null);
    setOutcome(null);
    setShot(null);
    setVolley(false);
    setFromZone(null);
    setToZone(null);
  }

  async function saveRally() {
    if (!match || !score || !canSave || saving) return;
    setSaving(true);
    setError(null);

    const hitter = hasShot
      ? outcome === "winner"
        ? pointWinner
        : opponent(pointWinner!)
      : null;

    const rally: Rally = {
      id: crypto.randomUUID(),
      match_id: match.id,
      game_number: score.current.number,
      rally_number: score.nextRallyNumber,
      outcome: isLet ? "let" : outcome!,
      point_winner_id: isLet ? null : pointWinner,
      hitter_id: hitter,
      shot_type: hasShot ? shot : null,
      is_volley: hasShot ? volley : false,
      hit_from_zone: hasShot ? fromZone : null,
      landed_zone: hasShot ? toZone : null,
    };

    const { error: insErr } = await supabase.from("rallies").insert(rally);
    if (insErr) {
      setSaving(false);
      return setError(insErr.message);
    }

    const next = [...rallies, rally];
    setRallies(next);

    const s = computeScore(
      next,
      match.player1_id,
      match.player2_id,
      match.best_of,
    );
    if (s.matchWinner) {
      await supabase
        .from("matches")
        .update({ status: "completed", winner_id: s.matchWinner })
        .eq("id", match.id);
      setMatch({ ...match, status: "completed", winner_id: s.matchWinner });
    }

    resetForm();
    setSaving(false);
  }

  async function undoLast() {
    if (!match) return;
    const last = sortRallies(rallies).at(-1);
    if (!last || !confirm("Delete the last rally?")) return;

    const { error: delErr } = await supabase
      .from("rallies")
      .delete()
      .eq("id", last.id);
    if (delErr) return setError(delErr.message);
    setRallies(rallies.filter((r) => r.id !== last.id));

    if (match.status === "completed") {
      await supabase
        .from("matches")
        .update({ status: "in_progress", winner_id: null })
        .eq("id", match.id);
      setMatch({ ...match, status: "in_progress", winner_id: null });
    }
  }

  async function endEarly() {
    if (!match) return;
    const reason = prompt("Why is the match ending early? (e.g. injury)");
    if (reason === null) return;

    const { error: upErr } = await supabase
      .from("matches")
      .update({ status: "terminated", termination_reason: reason || null })
      .eq("id", match.id);
    if (upErr) return setError(upErr.message);
    setMatch({
      ...match,
      status: "terminated",
      termination_reason: reason || null,
    });
  }

  const finishedGames = score.games.filter((g) => g.winner);
  const recent = sortRallies(rallies).reverse().slice(0, 5);

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <Link href="/" className="text-sm text-muted">
        ← Matches
      </Link>

      {/* Scoreboard */}
      <div className="mt-3 rounded-xl border border-line bg-surface p-4">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted">
          Best of {match.best_of}
          {live && ` · Game ${score.current.number}`}
        </p>
        {[
          {
            pid: match.player1_id,
            label: match.p1.name,
            games: score.p1Games,
            pts: score.current.p1,
          },
          {
            pid: match.player2_id,
            label: match.p2.name,
            games: score.p2Games,
            pts: score.current.p2,
          },
        ].map((row) => (
          <div key={row.pid} className="flex items-center justify-between py-1">
            <span className="font-medium">{row.label}</span>
            <span className="flex items-center gap-4">
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-muted">
                {row.games}
              </span>
              <span className="w-8 text-right text-2xl font-semibold tabular-nums">
                {live ? row.pts : ""}
              </span>
            </span>
          </div>
        ))}
        {finishedGames.length > 0 && (
          <p className="mt-3 border-t border-line pt-3 text-xs tabular-nums text-muted">
            {finishedGames.map((g) => `${g.p1}–${g.p2}`).join("   ")}
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {/* Match over */}
      {!live && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
          {match.status === "completed" ? (
            <p>
              Match won by{" "}
              <span className="text-accent">{name(match.winner_id)}</span>
            </p>
          ) : (
            <p className="text-red-300/90">
              Ended early
              {match.termination_reason ? `: ${match.termination_reason}` : ""}
            </p>
          )}
          {match.status === "completed" && (
            <button
              onClick={undoLast}
              className={`${secondaryClass} mt-3 w-full`}
            >
              Undo last rally
            </button>
          )}
        </div>
      )}

      {/* Rally form */}
      {live && (
        <div className="mt-6 space-y-6">
          <section>
            <SectionLabel>Point to</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <Chip
                active={pointWinner === match.player1_id}
                onClick={() => setPointWinner(match.player1_id)}
              >
                {match.p1.name}
              </Chip>
              <Chip
                active={pointWinner === match.player2_id}
                onClick={() => setPointWinner(match.player2_id)}
              >
                {match.p2.name}
              </Chip>
              <Chip active={isLet} onClick={() => setPointWinner("let")}>
                Let
              </Chip>
            </div>
          </section>

          <section
            className={`transition-opacity ${isLet || !pointWinner ? "pointer-events-none opacity-30" : ""}`}
          >
            <SectionLabel>How</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <Chip
                  key={o.value}
                  active={outcome === o.value}
                  onClick={() => setOutcome(o.value)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </section>

          <section
            className={`transition-opacity ${hasShot ? "" : "pointer-events-none opacity-30"}`}
          >
            <SectionLabel>
              Last shot
              {hasShot && pointWinner && (
                <span className="normal-case tracking-normal text-fg/60">
                  {" "}
                  ·{" "}
                  {name(
                    outcome === "winner" ? pointWinner : opponent(pointWinner),
                  )}
                </span>
              )}
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SHOTS.map((s) => (
                <Chip
                  key={s.value}
                  active={shot === s.value}
                  onClick={() => setShot(shot === s.value ? null : s.value)}
                >
                  {s.label}
                </Chip>
              ))}
              <Chip active={volley} onClick={() => setVolley(!volley)}>
                Volley
              </Chip>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <CourtPicker
              label="Hit from"
              value={fromZone}
              onChange={setFromZone}
              disabled={!hasShot}
            />
            <CourtPicker
              label="Ended up"
              value={toZone}
              onChange={setToZone}
              disabled={!hasShot}
            />
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={undoLast}
              disabled={rallies.length === 0}
              className={secondaryClass}
            >
              Undo last rally
            </button>
            <button onClick={endEarly} className={dangerClass}>
              End match early
            </button>
          </div>

          {recent.length > 0 && (
            <section>
              <SectionLabel>Recent</SectionLabel>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
                {recent.map((r) => (
                  <li key={r.id} className="flex gap-3 px-3 py-2">
                    <span className="shrink-0 tabular-nums text-muted">
                      G{r.game_number}·{r.rally_number}
                    </span>
                    <span className="text-fg/80">
                      {r.outcome === "let"
                        ? "Let"
                        : `${name(r.point_winner_id)} — ${r.outcome.replace("_", " ")}${
                            r.shot_type
                              ? ` (${r.is_volley ? "volley " : ""}${r.shot_type.replace("_", " ")})`
                              : ""
                          }`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Sticky save bar */}
      {live && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              onClick={saveRally}
              disabled={!canSave || saving}
              className={primaryClass}
            >
              {saving ? "Saving..." : "Save rally"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
