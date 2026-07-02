import { prisma } from "@/lib/prisma";
import { effectiveMatchStatus, effectiveMatchEnd } from "@/lib/match-status";

// Окно, за которое ещё имеет смысл проверять «идёт ли матч» (страховка размера выборки).
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

// Список турниров для каталога «Турниры» — всё, КРОМЕ ALGS (те живут в разделе ALGS).
// series = NULL тоже считается «не-ALGS» (в SQL `!= 'ALGS'` отбросил бы NULL).
export function getTournaments() {
  return prisma.tournament.findMany({
    where: { OR: [{ series: null }, { series: { not: "ALGS" } }] },
    orderBy: [{ startDate: "desc" }],
    include: {
      _count: { select: { participants: true, matches: true } },
    },
  });
}

// ===== Раздел ALGS =====

// Сезоны ALGS (лиги).
export function getAlgsSeasons() {
  return prisma.season.findMany({
    where: { series: "ALGS" },
    orderBy: [{ startDate: "desc" }],
    include: { _count: { select: { tournaments: true, splits: true } } },
  });
}

// Отдельные ALGS-турниры (серия ALGS, но не привязаны к сезону).
export function getAlgsStandaloneTournaments() {
  return prisma.tournament.findMany({
    where: { series: "ALGS", seasonId: null },
    orderBy: [{ startDate: "desc" }],
    include: { _count: { select: { participants: true } } },
  });
}

// Турнир по slug: лига (сезон/сплит), стадии+группы (составы), участники, матчи с результатами.
export function getTournamentBySlug(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: {
      season: true,
      split: true,
      stages: {
        orderBy: [{ order: "asc" }],
        include: {
          groups: {
            orderBy: [{ order: "asc" }],
            include: {
              teams: {
                orderBy: [{ seed: "asc" }],
                include: { team: true },
              },
            },
          },
        },
      },
      participants: {
        orderBy: [{ finalPlacement: "asc" }],
        include: {
          team: {
            include: {
              rosterSpots: {
                where: { endDate: null },
                include: { player: true },
              },
            },
          },
        },
      },
      matches: {
        orderBy: [{ order: "asc" }],
        include: {
          stage: true,
          group: true,
          _count: { select: { games: true } },
          games: {
            include: {
              teamResults: { include: { team: true } },
            },
          },
        },
      },
    },
  });
}

// ===== Лиги / сезоны =====

// Список сезонов (для индекса «Лиги»).
export function getSeasons() {
  return prisma.season.findMany({
    orderBy: [{ startDate: "desc" }],
    include: {
      _count: { select: { tournaments: true, splits: true } },
    },
  });
}

// Сезон по slug: сплиты + события (турниры) + агрегированные очки чемпионата.
export async function getSeasonBySlug(slug: string) {
  const season = await prisma.season.findUnique({
    where: { slug },
    include: {
      splits: { orderBy: [{ order: "asc" }] },
      tournaments: {
        orderBy: [{ startDate: "asc" }],
        include: { _count: { select: { participants: true } } },
      },
    },
  });
  if (!season) return null;
  const championship = await getChampionshipStandings(season.id);
  return { season, championship };
}

// Сквозные очки чемпионата: сумма по командам в рамках сезона.
export async function getChampionshipStandings(seasonId: string) {
  const grouped = await prisma.championshipPoint.groupBy({
    by: ["teamId"],
    where: { seasonId },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
  });
  if (grouped.length === 0) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: grouped.map((g) => g.teamId) } },
  });
  const byId = new Map(teams.map((t) => [t.id, t]));
  return grouped.map((g) => ({
    team: byId.get(g.teamId)!,
    points: g._sum.points ?? 0,
  }));
}

// Матч по id: игры с результатами команд + статистика игроков + стримы.
export function getMatchById(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      tournament: true,
      stage: true,
      streams: { include: { player: true, team: true } },
      games: {
        orderBy: [{ gameNumber: "asc" }],
        include: {
          teamResults: {
            orderBy: [{ placement: "asc" }],
            include: { team: true },
          },
          playerStats: {
            orderBy: [{ kills: "desc" }],
            include: { player: true, team: true },
          },
        },
      },
    },
  });
}

// ===== Запросы для главной-дашборда =====

// Идущие сейчас матчи с их трансляциями.
// «Идёт» = статус, вычисленный по расписанию (или закреплённый вручную в админке).
export async function getLiveMatches() {
  const now = new Date();
  const candidates = await prisma.match.findMany({
    where: {
      OR: [
        { statusLocked: true },
        { scheduledAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now } },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      tournament: true,
      streams: true,
    },
  });
  return candidates.filter((m) => effectiveMatchStatus(m, now) === "LIVE");
}

// Афиша: ближайшие предстоящие матчи.
export async function getUpcomingMatches(limit = 5) {
  const now = new Date();
  const candidates = await prisma.match.findMany({
    where: {
      OR: [{ statusLocked: true }, { scheduledAt: { gt: now } }],
    },
    orderBy: { scheduledAt: "asc" },
    include: { tournament: true },
  });
  return candidates
    .filter((m) => effectiveMatchStatus(m, now) === "UPCOMING")
    .slice(0, limit);
}

// Последние завершённые матчи (с данными для вычисления победителя).
export async function getRecentMatches(limit = 5) {
  const now = new Date();
  const candidates = await prisma.match.findMany({
    where: {
      OR: [{ statusLocked: true }, { scheduledAt: { lt: now } }],
    },
    include: {
      tournament: true,
      games: { include: { teamResults: { include: { team: true } } } },
    },
  });
  return candidates
    .filter((m) => effectiveMatchStatus(m, now) === "COMPLETED")
    .sort((a, b) => {
      const ea = effectiveMatchEnd(a)?.getTime() ?? 0;
      const eb = effectiveMatchEnd(b)?.getTime() ?? 0;
      return eb - ea;
    })
    .slice(0, limit);
}

const STATUS_ORDER: Record<string, number> = {
  LIVE: 0,
  UPCOMING: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

// Активные турниры: сперва идущие, затем предстоящие/завершённые.
export async function getActiveTournaments(limit = 6) {
  const all = await prisma.tournament.findMany({
    include: { _count: { select: { participants: true } } },
  });
  return all
    .sort((a, b) => {
      const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (s !== 0) return s;
      return (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0);
    })
    .slice(0, limit);
}

// Топ команд по сумме очков (с суммой киллов).
export async function getTopTeams(limit = 5) {
  const grouped = await prisma.teamGameResult.groupBy({
    by: ["teamId"],
    _sum: { totalPoints: true, kills: true },
    orderBy: { _sum: { totalPoints: "desc" } },
    take: limit,
  });
  const teams = await prisma.team.findMany({
    where: { id: { in: grouped.map((g) => g.teamId) } },
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return grouped.map((g) => ({
    team: teamById.get(g.teamId)!,
    points: g._sum.totalPoints ?? 0,
    kills: g._sum.kills ?? 0,
  }));
}

// ===== Лидерборды (раздел «Статистика») =====

// Лидерборд игроков (опционально в рамках одного турнира).
export async function getPlayerLeaderboard(tournamentId?: string) {
  const where = tournamentId
    ? { game: { match: { tournamentId } } }
    : {};
  const grouped = await prisma.playerGameStat.groupBy({
    by: ["playerId"],
    where,
    _sum: { kills: true, assists: true, damageDealt: true },
    _avg: { kills: true },
    _count: true,
  });
  const players = await prisma.player.findMany({
    where: { id: { in: grouped.map((g) => g.playerId) } },
    include: {
      rosterSpots: { where: { endDate: null }, include: { team: true } },
    },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  return grouped.map((g) => {
    const player = byId.get(g.playerId)!;
    return {
      player,
      team: player.rosterSpots[0]?.team ?? null,
      games: g._count,
      kills: g._sum.kills ?? 0,
      assists: g._sum.assists ?? 0,
      damage: g._sum.damageDealt ?? 0,
      avgKills: g._avg.kills ?? 0,
    };
  });
}

// Лидерборд команд (опционально в рамках одного турнира).
export async function getTeamLeaderboard(tournamentId?: string) {
  const where = tournamentId ? { game: { match: { tournamentId } } } : {};
  const grouped = await prisma.teamGameResult.groupBy({
    by: ["teamId"],
    where,
    _sum: { totalPoints: true, kills: true },
    _avg: { placement: true },
    _count: true,
  });
  const winsGrouped = await prisma.teamGameResult.groupBy({
    by: ["teamId"],
    where: { ...where, placement: 1 },
    _count: true,
  });
  const winsById = new Map(winsGrouped.map((w) => [w.teamId, w._count]));
  const teams = await prisma.team.findMany({
    where: { id: { in: grouped.map((g) => g.teamId) } },
  });
  const byId = new Map(teams.map((t) => [t.id, t]));
  return grouped.map((g) => ({
    team: byId.get(g.teamId)!,
    games: g._count,
    points: g._sum.totalPoints ?? 0,
    kills: g._sum.kills ?? 0,
    avgPlacement: g._avg.placement,
    wins: winsById.get(g.teamId) ?? 0,
  }));
}

// ===== Команда =====

export async function getTeamBySlug(slug: string) {
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      rosterSpots: { where: { endDate: null }, include: { player: true } },
      participants: {
        include: { tournament: true },
        orderBy: { tournament: { startDate: "desc" } },
      },
    },
  });
  if (!team) return null;

  const agg = await prisma.teamGameResult.aggregate({
    where: { teamId: team.id },
    _sum: { kills: true, totalPoints: true },
    _avg: { placement: true },
    _count: true,
  });
  const wins = await prisma.teamGameResult.count({
    where: { teamId: team.id, placement: 1 },
  });
  const recentMatches = await prisma.match.findMany({
    where: { games: { some: { teamResults: { some: { teamId: team.id } } } } },
    include: { tournament: true },
    orderBy: { scheduledAt: "desc" },
    take: 5,
  });

  return {
    team,
    stats: {
      games: agg._count,
      kills: agg._sum.kills ?? 0,
      points: agg._sum.totalPoints ?? 0,
      avgPlacement: agg._avg.placement,
      wins,
    },
    recentMatches,
  };
}

// ===== Игрок =====

export async function getPlayerBySlug(slug: string) {
  const player = await prisma.player.findUnique({
    where: { slug },
    include: {
      rosterSpots: { where: { endDate: null }, include: { team: true } },
      streams: { where: { type: "PLAYER_POV" } },
    },
  });
  if (!player) return null;

  const agg = await prisma.playerGameStat.aggregate({
    where: { playerId: player.id },
    _sum: { kills: true, assists: true, damageDealt: true },
    _avg: { kills: true, damageDealt: true },
    _count: true,
  });
  const recentMatches = await prisma.match.findMany({
    where: { games: { some: { playerStats: { some: { playerId: player.id } } } } },
    include: { tournament: true },
    orderBy: { scheduledAt: "desc" },
    take: 5,
  });

  return {
    player,
    stats: {
      games: agg._count,
      kills: agg._sum.kills ?? 0,
      assists: agg._sum.assists ?? 0,
      damage: agg._sum.damageDealt ?? 0,
      avgKills: agg._avg.kills,
      avgDamage: agg._avg.damageDealt,
    },
    recentMatches,
  };
}

export type TournamentListItem = Awaited<
  ReturnType<typeof getTournaments>
>[number];
export type TournamentDetail = Awaited<ReturnType<typeof getTournamentBySlug>>;
export type MatchDetail = Awaited<ReturnType<typeof getMatchById>>;
export type SeasonDetail = Awaited<ReturnType<typeof getSeasonBySlug>>;
