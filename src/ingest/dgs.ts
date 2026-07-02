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
  ranking?: number[]; // место команды в каждой игре (по индексу == gamesPlayed)
  playersData?: DgsPlayer[];
};

// Очки за место по системе ALGS (для приблизительной разбивки очков по играм;
// итоговые очки турнира берём точными из DGS — в TournamentParticipant).
const PLACEMENT_POINTS: Record<number, number> = {
  1: 12, 2: 9, 3: 7, 4: 5, 5: 4, 6: 3, 7: 3, 8: 2, 9: 2, 10: 2,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
};
const placementPoints = (p: number) => PLACEMENT_POINTS[p] ?? 0;

// Метаданные игр турнира (карта, номер) — из getTournaments, если турнир в выдаче.
type GameMeta = { map: string | null; number: number };

// Приводим внутренние коды карт Apex к человекочитаемым названиям.
const MAP_NAMES: Record<string, string> = {
  mp_rr_canyonlands: "Kings Canyon",
  mp_rr_desertlands: "World's Edge",
  mp_rr_olympus: "Olympus",
  mp_rr_tropic_island: "Storm Point",
  mp_rr_district: "E-District",
  mp_rr_divided_moon: "Broken Moon",
};
function mapName(raw: string | null): string | null {
  if (!raw) return raw;
  const key = Object.keys(MAP_NAMES).find((k) => raw.toLowerCase().startsWith(k));
  return key ? MAP_NAMES[key] : raw;
}

// Тянет getScores по одному турниру и раскладывает по N играм:
//  - у каждой игры реальные карта (если известна) и место каждой команды;
//  - суммарные киллы/статистику игроков DGS отдаёт только за весь турнир,
//    поэтому кладём их агрегатом (в первую игру), а не по играм.
async function ingestOneTournament(
  tournamentId: string,
  dgsId: string,
  gameMetaById: Map<string, GameMeta>,
) {
  const scores = (await dgsGet("getScores", { tournamentId: dgsId })) as Json;
  const teamData = (scores.teamData as DgsTeam[] | undefined) ?? [];
  const gamesPlayed = (scores.gamesPlayed as string[] | undefined) ?? [];
  if (teamData.length === 0) return { dgsId, teams: 0, note: "нет данных" };

  const gameCount = Math.max(
    gamesPlayed.length,
    ...teamData.map((t) => t.ranking?.length ?? 0),
    1,
  );

  // Идемпотентность: удаляем прошлый DGS-контейнер и участников этого турнира.
  await prisma.match.deleteMany({ where: { tournamentId, label: DGS_MATCH_LABEL } });
  await prisma.tournamentParticipant.deleteMany({ where: { tournamentId } });

  // Один матч-контейнер, внутри — N игр.
  const match = await prisma.match.create({
    data: {
      tournamentId,
      label: DGS_MATCH_LABEL,
      status: "COMPLETED",
      statusLocked: true,
      order: 0,
    },
  });

  // Создаём игры (с картой/номером из метаданных, если удалось их получить).
  const games = [];
  for (let i = 0; i < gameCount; i++) {
    const meta = gameMetaById.get(gamesPlayed[i] ?? "");
    const g = await prisma.game.create({
      data: {
        matchId: match.id,
        gameNumber: meta?.number ?? i + 1,
        map: meta?.map ?? null,
        status: "COMPLETED",
      },
    });
    games.push(g);
  }

  // Ранжируем команды по итоговым очкам → финальное место в турнире.
  const ranked = [...teamData].sort((a, b) => num(b.points) - num(a.points));

  let teamsWritten = 0;
  for (let r = 0; r < ranked.length; r++) {
    const t = ranked[r];
    const teamName = (t.teamName ?? "").trim();
    if (!teamName) continue;
    const finalPlacement = r + 1;
    const teamId = await upsertTeamByName(teamName);
    const points = num(t.points);
    const kills = num(t.kills);

    await prisma.tournamentParticipant.create({
      data: { tournamentId, teamId, totalPoints: points, finalPlacement },
    });

    // Место команды по каждой игре (0 = не играла → пропускаем).
    for (let i = 0; i < gameCount; i++) {
      const place = num(t.ranking?.[i]);
      if (place <= 0) continue;
      const pPts = placementPoints(place);
      // Суммарные киллы турнира кладём в первую игру команды (per-game API не даёт).
      const isFirst = i === 0;
      await prisma.teamGameResult.create({
        data: {
          gameId: games[i].id,
          teamId,
          placement: place,
          kills: isFirst ? kills : 0,
          killPoints: isFirst ? kills : 0,
          placementPoints: pPts,
          totalPoints: pPts + (isFirst ? kills : 0),
        },
      });
    }

    // Статистика игроков — агрегат за турнир (кладём в первую игру).
    for (const p of t.playersData ?? []) {
      const pid = p.playerId;
      const pname = (p.playerName ?? "").trim();
      if (!pid || !pname) continue;
      const playerId = await upsertPlayer(pid, pname);
      await ensureRoster(teamId, playerId);
      await prisma.playerGameStat.create({
        data: {
          gameId: games[0].id,
          playerId,
          teamId,
          kills: num(p.kills),
          assists: num(p.assists),
          damageDealt: num(p.damageDealt),
          revives: num(p.revivesGiven),
          placement: num(t.ranking?.[0]) || null,
        },
      });
    }
    teamsWritten++;
  }

  await linkExternal("match", match.id, dgsId);
  return { dgsId, teams: teamsWritten, games: gameCount };
}

// Строит карту gameId → {карта, номер} из getTournaments (best-effort).
async function fetchGameMeta(): Promise<Map<string, GameMeta>> {
  const map = new Map<string, GameMeta>();
  try {
    const raw = (await dgsGet("getTournaments", { allGames: "1" })) as Json;
    const list: Json[] = Array.isArray(raw) ? (raw as Json[]) : [];
    for (const tour of list) {
      const gs = (tour.games as Json[] | undefined) ?? [];
      for (const g of gs) {
        const id = typeof g.id === "string" ? g.id : null;
        if (!id) continue;
        const title = typeof g.title === "string" ? g.title : "";
        const n = parseInt(title.replace(/[^0-9]/g, ""), 10);
        map.set(id, {
          map: mapName(typeof g.map === "string" ? g.map : null),
          number: Number.isFinite(n) && n > 0 ? n : map.size + 1,
        });
      }
    }
  } catch {
    // Метаданные не критичны — при неудаче номера игр берём по порядку.
  }
  return map;
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

  const gameMetaById = await fetchGameMeta();

  const results: unknown[] = [];
  for (const link of links) {
    try {
      const r = await ingestOneTournament(link.entityId, link.externalId, gameMetaById);
      console.log(`DGS: турнир ${link.externalId} →`, r);
      results.push(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`DGS: турнир ${link.externalId}: ${msg}`);
    }
  }

  return { linkedTournaments: links.length, results };
}
