import { prisma } from "./db";
import { RateLimiter } from "./throttle";

// Базовый URL DGS «Ingram» — настраивается через env (на случай смены пути).
// Единая точка входа; эндпоинт передаётся query-параметром qt (напр. ?qt=getTournaments).
const DGS_BASE =
  process.env.DGS_API_BASE ?? "https://apexlegendsstatus.com/tournament/ingram/";

// ~2 запроса в секунду по условиям некоммерческой лицензии.
const limiter = new RateLimiter(550);

// Метка матча-контейнера, куда кладём агрегированную статистику из DGS.
const DGS_MATCH_LABEL = "Статистика турнира (DGS)";

type Json = Record<string, unknown>;

async function dgsGet(endpoint: string, params: Record<string, string> = {}) {
  await limiter.wait();
  const token = process.env.DGS_API_TOKEN!;
  const qs = new URLSearchParams({ qt: endpoint, ...params }).toString();
  const url = `${DGS_BASE}?${qs}`;
  const res = await fetch(url, {
    // Токен аккаунта в заголовке Authorization (из Profile Settings на сайте DGS).
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`DGS ${endpoint}: ${res.status}`);
  return res.json();
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 50) || "x"
  );
}

// Связывает нашу запись с внешним id (идемпотентность).
async function linkExternal(entityType: string, entityId: string, externalId: string) {
  await prisma.externalRef.upsert({
    where: { source_entityType_externalId: { source: "dgs", entityType, externalId } },
    create: { source: "dgs", entityType, entityId, externalId },
    update: { entityId },
  });
}

// Уникальный slug: добавляет суффикс при коллизии.
async function uniqueSlug(base: string, model: "team" | "player"): Promise<string> {
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const found =
      model === "team"
        ? await prisma.team.findUnique({ where: { slug } })
        : await prisma.player.findUnique({ where: { slug } });
    if (!found) return slug;
    slug = `${base}-${++n}`;
  }
}

// Команда по имени (для реальных турниров имена уникальны, напр. TSM).
async function upsertTeamByName(name: string): Promise<string> {
  const existing = await prisma.team.findFirst({ where: { name } });
  if (existing) return existing.id;
  const slug = await uniqueSlug(slugify(name), "team");
  const team = await prisma.team.create({ data: { name, slug } });
  return team.id;
}

// Игрок по стабильному DGS playerId (идемпотентно через ExternalRef).
async function upsertPlayer(dgsPlayerId: string, name: string): Promise<string> {
  const ref = await prisma.externalRef.findUnique({
    where: {
      source_entityType_externalId: {
        source: "dgs",
        entityType: "player",
        externalId: dgsPlayerId,
      },
    },
  });
  if (ref) return ref.entityId;
  const slug = await uniqueSlug(slugify(name), "player");
  const player = await prisma.player.create({ data: { handle: name, slug } });
  await linkExternal("player", player.id, dgsPlayerId);
  return player.id;
}

// Ростер (состав) — чтобы игрок отображался в команде. Создаём, если ещё нет.
async function ensureRoster(teamId: string, playerId: string) {
  const existing = await prisma.roster.findFirst({ where: { teamId, playerId, endDate: null } });
  if (!existing) await prisma.roster.create({ data: { teamId, playerId } });
}

type DgsPlayer = {
  playerName?: string;
  playerId?: string;
  kills?: number;
  damageDealt?: number;
  assists?: number;
  revivesGiven?: number;
};
type DgsTeam = {
  teamName?: string;
  points?: number;
  kills?: number;
  damageDealt?: number;
  assists?: number;
  knockdowns?: number;
  respawnsGiven?: number;
  playersData?: DgsPlayer[];
};

// Тянет getScores по одному турниру и заполняет участников + агрегированную статистику.
async function ingestOneTournament(tournamentId: string, dgsId: string) {
  const scores = (await dgsGet("getScores", { tournamentId: dgsId })) as Json;
  const teamData = (scores.teamData as DgsTeam[] | undefined) ?? [];
  if (teamData.length === 0) return { dgsId, teams: 0, note: "нет данных" };

  // Идемпотентность: удаляем прошлый DGS-контейнер и участников этого турнира.
  await prisma.match.deleteMany({ where: { tournamentId, label: DGS_MATCH_LABEL } });
  await prisma.tournamentParticipant.deleteMany({ where: { tournamentId } });

  // Один матч-контейнер + одна «игра» с агрегатом (DGS отдаёт суммарную статистику).
  const match = await prisma.match.create({
    data: {
      tournamentId,
      label: DGS_MATCH_LABEL,
      status: "COMPLETED",
      statusLocked: true,
      order: 0,
    },
  });
  const game = await prisma.game.create({
    data: { matchId: match.id, gameNumber: 1, map: null, status: "COMPLETED" },
  });

  // Ранжируем команды по очкам → финальное место.
  const ranked = [...teamData].sort((a, b) => num(b.points) - num(a.points));

  let teamsWritten = 0;
  for (let i = 0; i < ranked.length; i++) {
    const t = ranked[i];
    const teamName = (t.teamName ?? "").trim();
    if (!teamName) continue;
    const placement = i + 1;
    const teamId = await upsertTeamByName(teamName);
    const points = num(t.points);
    const kills = num(t.kills);

    await prisma.tournamentParticipant.create({
      data: { tournamentId, teamId, totalPoints: points, finalPlacement: placement },
    });

    await prisma.teamGameResult.create({
      data: {
        gameId: game.id,
        teamId,
        placement,
        kills,
        killPoints: kills,
        placementPoints: Math.max(0, points - kills),
        totalPoints: points,
      },
    });

    for (const p of t.playersData ?? []) {
      const pid = p.playerId;
      const pname = (p.playerName ?? "").trim();
      if (!pid || !pname) continue;
      const playerId = await upsertPlayer(pid, pname);
      await ensureRoster(teamId, playerId);
      await prisma.playerGameStat.create({
        data: {
          gameId: game.id,
          playerId,
          teamId,
          kills: num(p.kills),
          assists: num(p.assists),
          damageDealt: num(p.damageDealt),
          revives: num(p.revivesGiven),
          placement,
        },
      });
    }
    teamsWritten++;
  }

  await linkExternal("match", match.id, dgsId);
  return { dgsId, teams: teamsWritten };
}

export async function ingestDgs() {
  // Тянем только турниры, у которых в админке указан DGS-ID (через ExternalRef).
  const links = await prisma.externalRef.findMany({
    where: { source: "dgs", entityType: "tournament" },
  });

  if (links.length === 0) {
    console.log(
      "DGS: нет привязанных турниров. Укажите DGS ID турнира в админке (/admin) и повторите.",
    );
    return { linkedTournaments: 0 };
  }

  const results: unknown[] = [];
  for (const link of links) {
    try {
      const r = await ingestOneTournament(link.entityId, link.externalId);
      console.log(`DGS: турнир ${link.externalId} →`, r);
      results.push(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`DGS: турнир ${link.externalId}: ${msg}`);
    }
  }

  return { linkedTournaments: links.length, results };
}
