import { Rally, computeScore, sortRallies } from "./score";

export type PlayerMatch = {
  id: string;
  played_at: string;
  status: "in_progress" | "completed" | "terminated";
  best_of: number;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  p1: { name: string };
  p2: { name: string };
};

export const SHOT_LABELS: Record<string, string> = {
  drive: "Drive",
  crosscourt_drive: "Cross drive",
  boast: "Boast",
  drop: "Drop",
  crosscourt_drop: "Cross drop",
  lob: "Lob",
  kill: "Kill",
  serve: "Serve",
  other: "Other",
};

export const OUTCOME_LABELS: Record<string, string> = {
  winner: "Winners",
  unforced_error: "Unforced errors",
  forced_error: "Forced errors",
  stroke: "Strokes",
  no_let: "No lets",
};

export const ZONE_IDS = ["FL", "FR", "ML", "MR", "BL", "BR"] as const;

export type Row = { key: string; count: number; pct: number };
export type ZoneMap = { counts: Record<string, number>; total: number };
export type ShotEfficiency = { shot: string; winners: number; errors: number; net: number };
export type MatchLine = {
  match: PlayerMatch;
  opponent: string;
  gamesFor: number;
  gamesAgainst: number;
  gameScores: string[]; // from this player's point of view, e.g. "11–7"
  result: "W" | "L" | "Ended early" | "In progress";
};
export type HeadToHead = { opponent: string; wins: number; losses: number };

export type PlayerStats = {
  matchesPlayed: number;
  matchWins: number;
  matchLosses: number;
  endedEarly: number;
  inProgress: number;
  gamesWon: number;
  gamesLost: number;

  pointsWon: number;
  pointsLost: number;
  lets: number;

  wonBy: Row[];  // how points were won (winners, opponent errors, strokes...)
  lostBy: Row[]; // how points were lost

  winners: number;
  volleyWinners: number;
  unforcedErrors: number;
  forcedErrors: number;

  winnersByShot: Row[];    // shots this player hits winners with
  errorsByShot: Row[];     // shots this player makes errors with (forced + unforced)
  unforcedByShot: Row[];   // unforced errors only
  beatenByShot: Row[];     // opponent winners against this player
  lostByShot: Row[];       // errors + beaten-by, combined: every point lost with a shot recorded
  shotEfficiency: ShotEfficiency[];

  winnersFrom: ZoneMap;
  winnersLanded: ZoneMap;
  errorsFrom: ZoneMap;

  untagged: { winnerShot: number; winnerFrom: number; winnerLanded: number; errorShot: number };

  pressure: { won: number; lost: number }; // rallies played with both players on 9+
  matches: MatchLine[];
  headToHead: HeadToHead[];
};

function toRows(counts: Map<string, number>): Row[] {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, pct: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

function bump(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

function emptyZones(): ZoneMap {
  return { counts: Object.fromEntries(ZONE_IDS.map((z) => [z, 0])), total: 0 };
}

function addZone(z: ZoneMap, zone: string | null) {
  if (!zone || !(zone in z.counts)) return false;
  z.counts[zone]++;
  z.total++;
  return true;
}

export function computePlayerStats(
  playerId: string,
  matches: PlayerMatch[],
  rallies: Rally[]
): PlayerStats {
  const byMatch = new Map<string, Rally[]>();
  for (const r of rallies) {
    const list = byMatch.get(r.match_id) ?? [];
    list.push(r);
    byMatch.set(r.match_id, list);
  }

  const s: PlayerStats = {
    matchesPlayed: 0, matchWins: 0, matchLosses: 0, endedEarly: 0, inProgress: 0,
    gamesWon: 0, gamesLost: 0,
    pointsWon: 0, pointsLost: 0, lets: 0,
    wonBy: [], lostBy: [],
    winners: 0, volleyWinners: 0, unforcedErrors: 0, forcedErrors: 0,
    winnersByShot: [], errorsByShot: [], unforcedByShot: [], beatenByShot: [], lostByShot: [],
    shotEfficiency: [],
    winnersFrom: emptyZones(), winnersLanded: emptyZones(), errorsFrom: emptyZones(),
    untagged: { winnerShot: 0, winnerFrom: 0, winnerLanded: 0, errorShot: 0 },
    pressure: { won: 0, lost: 0 },
    matches: [], headToHead: [],
  };

  const wonBy = new Map<string, number>();
  const lostBy = new Map<string, number>();
  const winnersByShot = new Map<string, number>();
  const errorsByShot = new Map<string, number>();
  const unforcedByShot = new Map<string, number>();
  const beatenByShot = new Map<string, number>();
  const lostByShot = new Map<string, number>();
  const h2h = new Map<string, HeadToHead>();

  const sortedMatches = [...matches].sort((a, b) => b.played_at.localeCompare(a.played_at));

  for (const m of sortedMatches) {
    const isP1 = m.player1_id === playerId;
    const opp = isP1 ? m.player2_id : m.player1_id;
    const oppName = isP1 ? m.p2.name : m.p1.name;
    const mr = sortRallies(byMatch.get(m.id) ?? []);

    // ---- Match / game results
    const score = computeScore(mr, m.player1_id, m.player2_id, m.best_of);
    const gamesFor = isP1 ? score.p1Games : score.p2Games;
    const gamesAgainst = isP1 ? score.p2Games : score.p1Games;
    s.gamesWon += gamesFor;
    s.gamesLost += gamesAgainst;

    let result: MatchLine["result"];
    if (m.status === "in_progress") {
      result = "In progress";
      s.inProgress++;
    } else if (m.status === "terminated") {
      result = "Ended early";
      s.endedEarly++;
      s.matchesPlayed++;
    } else {
      const won = m.winner_id === playerId;
      result = won ? "W" : "L";
      s.matchesPlayed++;
      if (won) s.matchWins++;
      else s.matchLosses++;
      const h = h2h.get(oppName) ?? { opponent: oppName, wins: 0, losses: 0 };
      if (won) h.wins++;
      else h.losses++;
      h2h.set(oppName, h);
    }

    s.matches.push({
      match: m,
      opponent: oppName,
      gamesFor,
      gamesAgainst,
      gameScores: score.games
        .filter((g) => g.winner)
        .map((g) => (isP1 ? `${g.p1}–${g.p2}` : `${g.p2}–${g.p1}`)),
      result,
    });

    // ---- Rally-level stats
    const running = new Map<number, { me: number; them: number }>();
    for (const r of mr) {
      const gs = running.get(r.game_number) ?? { me: 0, them: 0 };
      running.set(r.game_number, gs);

      if (r.outcome === "let") {
        s.lets++;
        continue;
      }

      const iWon = r.point_winner_id === playerId;
      const iLost = r.point_winner_id === opp;
      if (!iWon && !iLost) continue;

      // Pressure points: score was 9-9 or later when the rally started
      if (gs.me >= 9 && gs.them >= 9) {
        if (iWon) s.pressure.won++;
        else s.pressure.lost++;
      }
      if (iWon) gs.me++;
      else gs.them++;

      if (iWon) {
        s.pointsWon++;
        bump(wonBy, r.outcome);
      } else {
        s.pointsLost++;
        bump(lostBy, r.outcome);
      }

      const shot = r.shot_type;

      // My winners
      if (r.outcome === "winner" && iWon) {
        s.winners++;
        if (r.is_volley) s.volleyWinners++;
        if (shot) bump(winnersByShot, shot);
        else s.untagged.winnerShot++;
        if (!addZone(s.winnersFrom, r.hit_from_zone)) s.untagged.winnerFrom++;
        if (!addZone(s.winnersLanded, r.landed_zone)) s.untagged.winnerLanded++;
      }

      // My errors (the hitter on an error rally is the player who made it)
      const isError = r.outcome === "unforced_error" || r.outcome === "forced_error";
      if (isError && r.hitter_id === playerId) {
        if (r.outcome === "unforced_error") s.unforcedErrors++;
        else s.forcedErrors++;
        if (shot) {
          bump(errorsByShot, shot);
          bump(lostByShot, shot);
          if (r.outcome === "unforced_error") bump(unforcedByShot, shot);
        } else {
          s.untagged.errorShot++;
        }
        addZone(s.errorsFrom, r.hit_from_zone);
      }

      // Opponent winners against me
      if (r.outcome === "winner" && iLost && shot) {
        bump(beatenByShot, shot);
        bump(lostByShot, `opp:${shot}`);
      }
    }
  }

  s.wonBy = toRows(wonBy);
  s.lostBy = toRows(lostBy);
  s.winnersByShot = toRows(winnersByShot);
  s.errorsByShot = toRows(errorsByShot);
  s.unforcedByShot = toRows(unforcedByShot);
  s.beatenByShot = toRows(beatenByShot);
  s.lostByShot = toRows(lostByShot);

  const shots = new Set([...winnersByShot.keys(), ...errorsByShot.keys()]);
  s.shotEfficiency = [...shots]
    .map((shot) => {
      const winners = winnersByShot.get(shot) ?? 0;
      const errors = errorsByShot.get(shot) ?? 0;
      return { shot, winners, errors, net: winners - errors };
    })
    .sort((a, b) => b.winners + b.errors - (a.winners + a.errors));

  s.headToHead = [...h2h.values()].sort(
    (a, b) => b.wins + b.losses - (a.wins + a.losses)
  );

  return s;
}

export function shotLabel(key: string) {
  if (key.startsWith("opp:")) return `Opponent ${SHOT_LABELS[key.slice(4)]?.toLowerCase() ?? key.slice(4)} winner`;
  return SHOT_LABELS[key] ?? key;
}

export function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "–";
}
