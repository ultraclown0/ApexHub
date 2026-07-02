import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DAY = 86_400_000;
const now = Date.now();

// Очки за место по системе ALGS (плюс 1 очко за каждый килл).
const PLACEMENT_POINTS: Record<number, number> = {
  1: 12, 2: 9, 3: 7, 4: 5, 5: 4, 6: 3, 7: 3, 8: 2, 9: 2, 10: 2,
  11: 1, 12: 1, 13: 1, 14: 1, 15: 1,
};
const placementPoints = (p: number) => PLACEMENT_POINTS[p] ?? 0;

const TEAMS = [
  { slug: "tsm", name: "TSM", tag: "TSM", region: "NA", players: ["ImperialHal", "Verhulst", "Reps"] },
  { slug: "alliance", name: "Alliance", tag: "ALL", region: "EMEA", players: ["Hardecki", "Zylione", "Yuki"] },
  { slug: "nrg", name: "NRG", tag: "NRG", region: "NA", players: ["sweetdreams", "Gild", "Zer0"] },
  { slug: "darkzero", name: "DarkZero", tag: "DZ", region: "NA", players: ["Faide", "HisWattson", "ojrein"] },
  { slug: "falcons", name: "Team Falcons", tag: "FAL", region: "EMEA", players: ["Effect", "Naghz", "Xenn"] },
  { slug: "fnatic", name: "Fnatic", tag: "FNC", region: "APAC", players: ["YukaF", "Chueng", "Nakssiee"] },
  { slug: "reignite", name: "REIGNITE", tag: "RGT", region: "APAC", players: ["Wigg", "Milk", "Ras"] },
  { slug: "gaimin", name: "Gaimin Gladiators", tag: "GMN", region: "EMEA", players: ["Danivh", "Zonixx", "Naisu"] },
  { slug: "disguised", name: "Disguised", tag: "DSG", region: "NA", players: ["Albralelie", "Genburten", "Sikezz"] },
  { slug: "riddle", name: "RIDDLE ORDER", tag: "RDL", region: "APAC", players: ["SqreamM", "Sizen", "Naoto"] },
];

type GameResult = { team: string; placement: number; kills: number };

const teamIdBySlug: Record<string, string> = {};
const playerIdByHandle: Record<string, string> = {};

// Детерминированное распределение командных киллов по троим игрокам.
function splitKills(total: number): [number, number, number] {
  const a = Math.ceil(total / 2);
  const b = Math.floor((total - a) * 0.6);
  return [a, b, total - a - b];
}

// Создаёт игру с результатами команд и статистикой игроков.
// Накапливает очки в pointsAcc[teamSlug] для турнирной таблицы.
async function createGameWithStats(
  matchId: string,
  gameNumber: number,
  map: string,
  status: "COMPLETED" | "LIVE",
  startedAt: Date,
  results: GameResult[],
  pointsAcc: Record<string, number>,
) {
  const game = await prisma.game.create({
    data: { matchId, gameNumber, map, status, startedAt },
  });

  for (const r of results) {
    const teamId = teamIdBySlug[r.team];
    const pPts = placementPoints(r.placement);
    const total = pPts + r.kills;
    pointsAcc[r.team] = (pointsAcc[r.team] ?? 0) + total;

    await prisma.teamGameResult.create({
      data: {
        gameId: game.id,
        teamId,
        placement: r.placement,
        kills: r.kills,
        placementPoints: pPts,
        killPoints: r.kills,
        totalPoints: total,
      },
    });

    const teamDef = TEAMS.find((t) => t.slug === r.team)!;
    const kills = splitKills(r.kills);
    for (let i = 0; i < teamDef.players.length; i++) {
      await prisma.playerGameStat.create({
        data: {
          gameId: game.id,
          playerId: playerIdByHandle[teamDef.players[i]],
          teamId,
          kills: kills[i],
          assists: Math.max(0, r.kills - kills[i] - i),
          knockdowns: kills[i] + (i === 0 ? 1 : 0),
          damageDealt: kills[i] * 250 + 400 + i * 90,
          damageTaken: 300 + i * 120,
          damageFromRing: 40 + i * 15,
          revives: i,
          respawnsGiven: i === 1 ? 1 : 0,
          survivalTime: 600 + r.placement * 30 + i * 20,
          placement: r.placement,
          character: ["Wraith", "Bloodhound", "Gibraltar"][i],
        },
      });
    }
  }
  return game;
}

// Записывает участников турнира с итоговыми очками (и местом, если завершён).
async function writeParticipants(
  tournamentId: string,
  pointsAcc: Record<string, number>,
  withPlacement: boolean,
) {
  const ranking = Object.entries(pointsAcc).sort((a, b) => b[1] - a[1]);
  for (let i = 0; i < ranking.length; i++) {
    const [slug, points] = ranking[i];
    await prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        teamId: teamIdBySlug[slug],
        totalPoints: points,
        finalPlacement: withPlacement ? i + 1 : null,
      },
    });
  }
}

// «Лёгкий» турнир: только участники (без игр/статистики) — для наполнения каталога.
async function createLightTournament(opts: {
  slug: string;
  name: string;
  region: string;
  status: "UPCOMING" | "LIVE" | "COMPLETED";
  startOffsetDays: number;
  endOffsetDays: number;
  organizer: string;
  teamSlugs: string[];
  descriptionRu?: string;
  descriptionEn?: string;
}) {
  const t = await prisma.tournament.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      region: opts.region,
      organizer: opts.organizer,
      status: opts.status,
      startDate: new Date(now + opts.startOffsetDays * DAY),
      endDate: new Date(now + opts.endOffsetDays * DAY),
      descriptionRu: opts.descriptionRu ?? null,
      descriptionEn: opts.descriptionEn ?? null,
    },
  });
  const withPlacement = opts.status === "COMPLETED";
  for (let i = 0; i < opts.teamSlugs.length; i++) {
    await prisma.tournamentParticipant.create({
      data: {
        tournamentId: t.id,
        teamId: teamIdBySlug[opts.teamSlugs[i]],
        totalPoints: 120 - i * 11,
        finalPlacement: withPlacement ? i + 1 : null,
      },
    });
  }
  return t;
}

async function main() {
  console.log("Очищаю таблицы…");
  await prisma.playerGameStat.deleteMany();
  await prisma.teamGameResult.deleteMany();
  await prisma.game.deleteMany();
  await prisma.match.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.roster.deleteMany();
  await prisma.tournamentParticipant.deleteMany();
  await prisma.stream.deleteMany();
  await prisma.externalRef.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tournament.deleteMany();

  console.log("Создаю команды и игроков…");
  for (const t of TEAMS) {
    const team = await prisma.team.create({
      data: { slug: t.slug, name: t.name, tag: t.tag, region: t.region },
    });
    teamIdBySlug[t.slug] = team.id;
    for (const handle of t.players) {
      const player = await prisma.player.create({
        data: {
          slug: handle.toLowerCase(),
          handle,
          role: t.players[0] === handle ? "IGL" : null,
        },
      });
      playerIdByHandle[handle] = player.id;
      await prisma.roster.create({
        data: { teamId: team.id, playerId: player.id, startDate: new Date(now - 180 * DAY) },
      });
    }
  }

  // ===== Турнир 1: ЗАВЕРШЁН (последние результаты) =====
  console.log("Турнир 1 (завершён)…");
  const champs = await prisma.tournament.create({
    data: {
      slug: "algs-y4-championship",
      name: "ALGS Year 4 Championship",
      region: "Global",
      tier: "official",
      organizer: "EA / Respawn",
      status: "COMPLETED",
      startDate: new Date(now - 7 * DAY),
      endDate: new Date(now - 5 * DAY),
      descriptionEn: "The crowning event of the Apex Legends Global Series Year 4.",
      descriptionRu: "Главный турнир четвёртого года Apex Legends Global Series.",
    },
  });
  const champsStage = await prisma.stage.create({
    data: { tournamentId: champs.id, name: "Finals", order: 1 },
  });
  const champsMatch = await prisma.match.create({
    data: {
      tournamentId: champs.id,
      stageId: champsStage.id,
      label: "Match Day 1 — Finals",
      status: "COMPLETED",
      order: 1,
      scheduledAt: new Date(now - 5 * DAY),
    },
  });
  const champsPoints: Record<string, number> = {};
  await createGameWithStats(champsMatch.id, 1, "World's Edge", "COMPLETED", new Date(now - 5 * DAY), [
    { team: "tsm", placement: 1, kills: 8 },
    { team: "darkzero", placement: 2, kills: 10 },
    { team: "nrg", placement: 3, kills: 5 },
    { team: "alliance", placement: 4, kills: 3 },
  ], champsPoints);
  await createGameWithStats(champsMatch.id, 2, "Storm Point", "COMPLETED", new Date(now - 5 * DAY + 3600_000), [
    { team: "nrg", placement: 1, kills: 9 },
    { team: "tsm", placement: 2, kills: 6 },
    { team: "alliance", placement: 3, kills: 7 },
    { team: "darkzero", placement: 4, kills: 4 },
  ], champsPoints);
  await writeParticipants(champs.id, champsPoints, true);
  await prisma.stream.create({
    data: { channelName: "apexlegends", type: "OFFICIAL", title: "ALGS Championship — Official", language: "en", tournamentId: champs.id, matchId: champsMatch.id, isLive: false },
  });

  // ===== Турнир 2: ИДЁТ СЕЙЧАС (live + афиша) =====
  console.log("Турнир 2 (live)…");
  const proLeague = await prisma.tournament.create({
    data: {
      slug: "algs-proleague-split2",
      name: "ALGS Pro League — Split 2",
      region: "EMEA",
      tier: "official",
      organizer: "EA / Respawn",
      status: "LIVE",
      startDate: new Date(now - 1 * DAY),
      endDate: new Date(now + 2 * DAY),
      descriptionEn: "Regional pro league, EMEA split 2.",
      descriptionRu: "Региональная про-лига, EMEA, сплит 2.",
    },
  });
  const proStage = await prisma.stage.create({
    data: { tournamentId: proLeague.id, name: "Regular Season", order: 1 },
  });
  // LIVE-матч (идёт сейчас): одна игра уже сыграна.
  const liveMatch = await prisma.match.create({
    data: {
      tournamentId: proLeague.id,
      stageId: proStage.id,
      label: "Week 3 — Day 2",
      status: "LIVE",
      order: 1,
      scheduledAt: new Date(now - 3600_000), // началось час назад
      endsAt: new Date(now + 3 * 3600_000), // окно ещё 3 часа → статус вычислится как LIVE
    },
  });
  const proPoints: Record<string, number> = {};
  await createGameWithStats(liveMatch.id, 1, "E-District", "COMPLETED", new Date(now - 3000_000), [
    { team: "alliance", placement: 1, kills: 11 },
    { team: "nrg", placement: 2, kills: 7 },
    { team: "tsm", placement: 3, kills: 6 },
    { team: "darkzero", placement: 4, kills: 5 },
  ], proPoints);
  await writeParticipants(proLeague.id, proPoints, false);
  // Live-трансляции этого матча.
  await prisma.stream.create({
    data: { channelName: "apexlegends", type: "OFFICIAL", title: "Pro League — Official Broadcast", language: "en", tournamentId: proLeague.id, matchId: liveMatch.id, isLive: true },
  });
  await prisma.stream.create({
    data: { channelName: "hardecki", type: "PLAYER_POV", title: "Hardecki POV", language: "en", matchId: liveMatch.id, playerId: playerIdByHandle["Hardecki"], teamId: teamIdBySlug["alliance"], isLive: true },
  });
  await prisma.stream.create({
    data: { channelName: "imperialhal", type: "PLAYER_POV", title: "ImperialHal POV", language: "en", matchId: liveMatch.id, playerId: playerIdByHandle["ImperialHal"], teamId: teamIdBySlug["tsm"], isLive: true },
  });

  // Предстоящий матч (афиша).
  await prisma.match.create({
    data: {
      tournamentId: proLeague.id,
      stageId: proStage.id,
      label: "Week 3 — Day 3",
      status: "UPCOMING",
      order: 2,
      scheduledAt: new Date(now + 2 * DAY),
    },
  });

  // ===== Дополнительные турниры для каталога (разные статусы и регионы) =====
  console.log("Дополнительные турниры для каталога…");

  // Идёт сейчас
  await createLightTournament({
    slug: "algs-proleague-na-split2", name: "ALGS Pro League — NA Split 2",
    region: "NA", status: "LIVE", startOffsetDays: -2, endOffsetDays: 3,
    organizer: "EA / Respawn",
    teamSlugs: ["tsm", "nrg", "darkzero", "disguised"],
    descriptionRu: "Региональная про-лига, Северная Америка, сплит 2.",
    descriptionEn: "Regional pro league, North America, split 2.",
  });
  await createLightTournament({
    slug: "apac-n-showdown", name: "APAC North Showdown",
    region: "APAC", status: "LIVE", startOffsetDays: -1, endOffsetDays: 1,
    organizer: "Community",
    teamSlugs: ["fnatic", "reignite", "riddle"],
    descriptionRu: "Показательный турнир региона APAC North.",
    descriptionEn: "APAC North showcase tournament.",
  });

  // Скоро
  await createLightTournament({
    slug: "algs-y5-open", name: "ALGS Year 5 — Open Qualifier",
    region: "Global", status: "UPCOMING", startOffsetDays: 6, endOffsetDays: 8,
    organizer: "EA / Respawn",
    teamSlugs: ["tsm", "alliance", "nrg", "falcons", "fnatic"],
    descriptionRu: "Открытая квалификация пятого года ALGS.",
    descriptionEn: "Open qualifier for ALGS Year 5.",
  });
  await createLightTournament({
    slug: "emea-challenger-circuit", name: "EMEA Challenger Circuit",
    region: "EMEA", status: "UPCOMING", startOffsetDays: 12, endOffsetDays: 14,
    organizer: "Community",
    teamSlugs: ["alliance", "falcons", "gaimin"],
    descriptionRu: "Челленджерская серия региона EMEA.",
    descriptionEn: "Challenger circuit for the EMEA region.",
  });
  await createLightTournament({
    slug: "na-summer-brawl", name: "NA Summer Brawl",
    region: "NA", status: "UPCOMING", startOffsetDays: 3, endOffsetDays: 4,
    organizer: "Community",
    teamSlugs: ["tsm", "nrg", "darkzero", "disguised"],
    descriptionRu: "Летний любительский турнир, Северная Америка.",
    descriptionEn: "Amateur summer tournament, North America.",
  });

  // Завершён
  await createLightTournament({
    slug: "apac-invitational-spring", name: "APAC Spring Invitational",
    region: "APAC", status: "COMPLETED", startOffsetDays: -20, endOffsetDays: -18,
    organizer: "Community",
    teamSlugs: ["reignite", "fnatic", "riddle"],
    descriptionRu: "Весенний пригласительный турнир APAC.",
    descriptionEn: "APAC spring invitational.",
  });
  await createLightTournament({
    slug: "esports-arena-winter", name: "Esports Arena Winter Cup",
    region: "NA", status: "COMPLETED", startOffsetDays: -35, endOffsetDays: -34,
    organizer: "Esports Arena",
    teamSlugs: ["nrg", "tsm", "disguised", "darkzero"],
    descriptionRu: "Зимний кубок, Северная Америка.",
    descriptionEn: "Winter cup, North America.",
  });
  await createLightTournament({
    slug: "emea-community-cup", name: "EMEA Community Cup",
    region: "EMEA", status: "COMPLETED", startOffsetDays: -14, endOffsetDays: -13,
    organizer: "Community",
    teamSlugs: ["gaimin", "alliance", "falcons"],
    descriptionRu: "Любительский кубок сообщества EMEA.",
    descriptionEn: "EMEA community cup (amateur).",
  });

  const counts = {
    tournaments: await prisma.tournament.count(),
    matches: await prisma.match.count(),
    liveMatches: await prisma.match.count({ where: { status: "LIVE" } }),
    upcoming: await prisma.match.count({ where: { status: "UPCOMING" } }),
    liveStreams: await prisma.stream.count({ where: { isLive: true } }),
    playerStats: await prisma.playerGameStat.count(),
  };
  console.log("Готово ✅", counts);
}

main()
  .catch((e) => {
    console.error("Ошибка seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
