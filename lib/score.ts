export type Rally = {
  id: string;
  match_id: string;
  game_number: number;
  rally_number: number;
  outcome: string;
  point_winner_id: string | null;
  hitter_id: string | null;
  shot_type: string | null;
  is_volley: boolean;
  hit_from_zone: string | null;
  landed_zone: string | null;
};

export type GameScore = { number: number; p1: number; p2: number; winner: string | null };

export function sortRallies(rallies: Rally[]) {
  return [...rallies].sort(
    (a, b) => a.game_number - b.game_number || a.rally_number - b.rally_number
  );
}

export function computeScore(rallies: Rally[], p1Id: string, p2Id: string, bestOf: number) {
  const gamesToWin = Math.ceil(bestOf / 2);
  const sorted = sortRallies(rallies);
  const games: GameScore[] = [];

  for (const r of sorted) {
    let g = games.find((x) => x.number === r.game_number);
    if (!g) {
      g = { number: r.game_number, p1: 0, p2: 0, winner: null };
      games.push(g);
    }
    if (r.point_winner_id === p1Id) g.p1++;
    else if (r.point_winner_id === p2Id) g.p2++;
    if (!g.winner && Math.max(g.p1, g.p2) >= 11 && Math.abs(g.p1 - g.p2) >= 2) {
      g.winner = g.p1 > g.p2 ? p1Id : p2Id;
    }
  }
  games.sort((a, b) => a.number - b.number);

  const p1Games = games.filter((g) => g.winner === p1Id).length;
  const p2Games = games.filter((g) => g.winner === p2Id).length;
  const matchWinner = p1Games >= gamesToWin ? p1Id : p2Games >= gamesToWin ? p2Id : null;

  const currentNumber = games.filter((g) => g.winner).length + 1;
  const current =
    games.find((g) => g.number === currentNumber) ??
    { number: currentNumber, p1: 0, p2: 0, winner: null };
  const nextRallyNumber = sorted.filter((r) => r.game_number === currentNumber).length + 1;

  return { games, current, p1Games, p2Games, matchWinner, nextRallyNumber };
}