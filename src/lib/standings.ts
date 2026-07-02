// Расчёт турнирной таблицы (standings) из результатов игр.
// Данные пер-гейм уже лежат в TeamGameResult — суммируем их, не дёргая внешние API.

export type TeamResultLike = {
  teamId: string;
  team: { slug: string; name: string; tag: string | null };
  placement: number | null;
  kills: number;
  totalPoints: number;
};

export type GameLike = { teamResults: TeamResultLike[] };
export type MatchLike = { games: GameLike[] };

export type StandingRow = {
  teamId: string;
  slug: string;
  name: string;
  tag: string | null;
  games: number;
  wins: number; // побед (1-е место в игре)
  kills: number;
  points: number;
  avgPlacement: number | null;
};

// Суммирует результаты по матчам в таблицу. Если задан allowedTeamIds —
// учитываются только эти команды (например, состав одной группы).
export function standingsFromMatches(
  matches: MatchLike[],
  allowedTeamIds?: Set<string>,
): StandingRow[] {
  const acc = new Map<
    string,
    {
      row: Omit<StandingRow, "avgPlacement">;
      placementSum: number;
      placementCount: number;
    }
  >();

  for (const match of matches) {
    for (const game of match.games) {
      for (const r of game.teamResults) {
        if (allowedTeamIds && !allowedTeamIds.has(r.teamId)) continue;
        const entry =
          acc.get(r.teamId) ??
          {
            row: {
              teamId: r.teamId,
              slug: r.team.slug,
              name: r.team.name,
              tag: r.team.tag,
              games: 0,
              wins: 0,
              kills: 0,
              points: 0,
            },
            placementSum: 0,
            placementCount: 0,
          };
        entry.row.games += 1;
        entry.row.kills += r.kills;
        entry.row.points += r.totalPoints;
        if (r.placement === 1) entry.row.wins += 1;
        if (r.placement != null) {
          entry.placementSum += r.placement;
          entry.placementCount += 1;
        }
        acc.set(r.teamId, entry);
      }
    }
  }

  return [...acc.values()]
    .map((e) => ({
      ...e.row,
      avgPlacement: e.placementCount
        ? e.placementSum / e.placementCount
        : null,
    }))
    .sort((a, b) => b.points - a.points || b.kills - a.kills);
}
