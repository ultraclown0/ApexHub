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

type Fmt = "SINGLE_LOBBY" | "MATCH_POINT" | "ROUND_ROBIN" | "BRACKET" | "LEAGUE" | "OTHER";
type EvType =
  | "CHALLENGER_CIRCUIT" | "ONLINE_OPEN" | "PRO_LEAGUE_QUALIFIER" | "PRO_LEAGUE"
  | "SPLIT_PLAYOFFS" | "LCQ" | "CHAMPIONSHIP" | "OTHER";
type Status = "UPCOMING" | "LIVE" | "COMPLETED";

// ===== Команды =====
// У «известных» команд ники прописаны; у остальных генерируются детерминированно.
type TeamDef = { slug: string; name: string; tag: string; region: string; players?: string[] };

const TEAMS: TeamDef[] = [
  // Americas (реальные ники у первых четырёх)
  { slug: "tsm", name: "TSM", tag: "TSM", region: "Americas", players: ["ImperialHal", "Verhulst", "Reps"] },
  { slug: "nrg", name: "NRG", tag: "NRG", region: "Americas", players: ["sweetdreams", "Gild", "Zer0"] },
  { slug: "darkzero", name: "DarkZero", tag: "DZ", region: "Americas", players: ["Faide", "HisWattson", "ojrein"] },
  { slug: "disguised", name: "Disguised", tag: "DSG", region: "Americas", players: ["Albralelie", "Genburten", "Sikezz"] },
  { slug: "100t", name: "100 Thieves", tag: "100T", region: "Americas" },
  { slug: "furia", name: "FURIA", tag: "FUR", region: "Americas" },
  { slug: "luminosity", name: "Luminosity Gaming", tag: "LG", region: "Americas" },
  { slug: "complexity", name: "Complexity", tag: "COL", region: "Americas" },
  { slug: "moist", name: "Moist Esports", tag: "MST", region: "Americas" },
  { slug: "cloud9", name: "Cloud9", tag: "C9", region: "Americas" },
  { slug: "sentinels", name: "Sentinels", tag: "SEN", region: "Americas" },
  { slug: "oxygen", name: "Oxygen Esports", tag: "OXG", region: "Americas" },
  { slug: "shopify", name: "Shopify Rebellion", tag: "SR", region: "Americas" },
  { slug: "xset", name: "XSET", tag: "XSET", region: "Americas" },
  { slug: "spacestation", name: "Spacestation Gaming", tag: "SSG", region: "Americas" },
  { slug: "element6", name: "Element 6", tag: "E6", region: "Americas" },
  { slug: "g2", name: "G2 Esports", tag: "G2", region: "Americas" },
  { slug: "ethereal", name: "Ethereal", tag: "ETH", region: "Americas" },
  { slug: "zenith", name: "Zenith", tag: "ZEN", region: "Americas" },
  { slug: "vexed", name: "Vexed Gaming", tag: "VEX", region: "Americas" },
  { slug: "omen", name: "Omen Esports", tag: "OMEN", region: "Americas" },
  { slug: "flux", name: "Flux Gaming", tag: "FLUX", region: "Americas" },
  { slug: "apex9", name: "Apex9", tag: "AP9", region: "Americas" },
  { slug: "rogue", name: "Rogue", tag: "RGE", region: "Americas" },
  { slug: "noble", name: "Noble", tag: "NBL", region: "Americas" },
  { slug: "torrent", name: "Torrent", tag: "TOR", region: "Americas" },
  { slug: "hyper", name: "Hyper Esports", tag: "HYP", region: "Americas" },
  { slug: "pulse", name: "Pulse", tag: "PLS", region: "Americas" },
  { slug: "void", name: "Void Gaming", tag: "VOID", region: "Americas" },
  { slug: "nexgen", name: "NexGen", tag: "NXG", region: "Americas" },
  // EMEA
  { slug: "alliance", name: "Alliance", tag: "ALL", region: "EMEA", players: ["Hardecki", "Zylione", "Yuki"] },
  { slug: "falcons", name: "Team Falcons", tag: "FAL", region: "EMEA", players: ["Effect", "Naghz", "Xenn"] },
  { slug: "gaimin", name: "Gaimin Gladiators", tag: "GMN", region: "EMEA", players: ["Danivh", "Zonixx", "Naisu"] },
  { slug: "aurora", name: "Aurora", tag: "AUR", region: "EMEA" },
  { slug: "liquid", name: "Team Liquid", tag: "TL", region: "EMEA" },
  { slug: "gonext", name: "GoNext Esports", tag: "GNX", region: "EMEA" },
  // APAC North
  { slug: "fnatic", name: "Fnatic", tag: "FNC", region: "APAC North", players: ["YukaF", "Chueng", "Nakssiee"] },
  { slug: "reignite", name: "REIGNITE", tag: "RGT", region: "APAC North", players: ["Wigg", "Milk", "Ras"] },
  { slug: "riddle", name: "RIDDLE ORDER", tag: "RDL", region: "APAC North", players: ["SqreamM", "Sizen", "Naoto"] },
  { slug: "northeption", name: "Northeption", tag: "NTH", region: "APAC North" },
  { slug: "fennel", name: "FENNEL", tag: "FEN", region: "APAC North" },
  // APAC South
  { slug: "chained", name: "Chained Together", tag: "CT", region: "APAC South" },
  { slug: "bombastic", name: "Bombastic", tag: "BB", region: "APAC South" },
  { slug: "ignis", name: "Ignis Esports", tag: "IGZ", region: "APAC South" },
  { slug: "dragons", name: "Dragons", tag: "DRG", region: "APAC South" },
];

// Детерминированная генерация ников для команд без явного состава.
const SYL_A = ["Zy", "Kry", "No", "Vex", "Ravi", "Sol", "Kai", "Dra", "Fen", "Lux", "Ny", "Ax", "Bly", "Cru", "Dex", "Eko", "Fro", "Gly", "Hox", "Ira", "Jyn", "Kzo", "Lyr", "Mox", "Nyx", "Orb", "Pyx", "Qui", "Ryn", "Syl"];
const SYL_B = ["ox", "en", "ar", "is", "us", "el", "yn", "ex", "or", "ai", "um", "ez", "al", "io", "yx"];
let genIdx = 0;
function genHandle(): string {
  const a = genIdx % SYL_A.length;
  const b = Math.floor(genIdx / SYL_A.length) % SYL_B.length;
  genIdx++;
  return SYL_A[a] + SYL_B[b];
}

type GameResult = { team: string; placement: number; kills: number };

const teamIdBySlug: Record<string, string> = {};
const playerIdByHandle: Record<string, string> = {};
const teamPlayerIds: Record<string, string[]> = {}; // slug -> [playerId × 3]

const slugsByRegion = (region: string) =>
  TEAMS.filter((t) => t.region === region).map((t) => t.slug);

function splitKills(total: number): [number, number, number] {
  const a = Math.ceil(total / 2);
  const b = Math.floor((total - a) * 0.6);
  return [a, b, total - a - b];
}

// Создаёт игру + результаты команд + статистику игроков (пакетно, createMany).
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

  const teamRows = [];
  const playerRows = [];
  for (const r of results) {
    const teamId = teamIdBySlug[r.team];
    const pPts = placementPoints(r.placement);
    const total = pPts + r.kills;
    pointsAcc[r.team] = (pointsAcc[r.team] ?? 0) + total;
    teamRows.push({
      gameId: game.id, teamId, placement: r.placement, kills: r.kills,
      placementPoints: pPts, killPoints: r.kills, totalPoints: total,
    });
    const kills = splitKills(r.kills);
    const pids = teamPlayerIds[r.team];
    for (let i = 0; i < pids.length; i++) {
      playerRows.push({
        gameId: game.id, playerId: pids[i], teamId,
        kills: kills[i], assists: Math.max(0, r.kills - kills[i] - i),
        knockdowns: kills[i] + (i === 0 ? 1 : 0),
        damageDealt: kills[i] * 250 + 400 + i * 90,
        damageTaken: 300 + i * 120, damageFromRing: 40 + i * 15,
        revives: i, respawnsGiven: i === 1 ? 1 : 0,
        survivalTime: 600 + r.placement * 30 + i * 20,
        placement: r.placement, character: ["Wraith", "Bloodhound", "Gibraltar"][i],
      });
    }
  }
  await prisma.teamGameResult.createMany({ data: teamRows });
  await prisma.playerGameStat.createMany({ data: playerRows });
  return game;
}

// Итоговая таблица участников по накопленным очкам.
async function writeParticipants(
  tournamentId: string,
  pointsAcc: Record<string, number>,
  withPlacement: boolean,
) {
  const ranking = Object.entries(pointsAcc).sort((a, b) => b[1] - a[1]);
  await prisma.tournamentParticipant.createMany({
    data: ranking.map(([slug, points], i) => ({
      tournamentId, teamId: teamIdBySlug[slug], totalPoints: points,
      finalPlacement: withPlacement ? i + 1 : null,
    })),
  });
}

// Синтетический результат игры для лобби: место = позиция после сдвига, киллы по формуле.
function syntheticGame(slugs: string[], seed: number): GameResult[] {
  const n = slugs.length;
  const rot = seed % n;
  const ordered = [...slugs.slice(rot), ...slugs.slice(0, rot)];
  return ordered.map((team, i) => ({
    team, placement: i + 1, kills: Math.max(0, n - i - (seed % 3)),
  }));
}

// «Лёгкий» турнир: участники без пошаговой статистики.
async function createLightTournament(opts: {
  slug: string; name: string; region: string; status: Status;
  startOffsetDays: number; endOffsetDays: number; organizer: string;
  teamSlugs: string[]; descriptionRu?: string; descriptionEn?: string;
  series?: string; format?: Fmt; eventType?: EvType;
  seasonId?: string; splitId?: string;
}) {
  const t = await prisma.tournament.create({
    data: {
      slug: opts.slug, name: opts.name, region: opts.region, organizer: opts.organizer,
      status: opts.status, series: opts.series ?? null, format: opts.format ?? "SINGLE_LOBBY",
      eventType: opts.eventType ?? null, seasonId: opts.seasonId ?? null, splitId: opts.splitId ?? null,
      startDate: new Date(now + opts.startOffsetDays * DAY),
      endDate: new Date(now + opts.endOffsetDays * DAY),
      descriptionRu: opts.descriptionRu ?? null, descriptionEn: opts.descriptionEn ?? null,
    },
  });
  const withPlacement = opts.status === "COMPLETED";
  await prisma.tournamentParticipant.createMany({
    data: opts.teamSlugs.map((slug, i) => ({
      tournamentId: t.id, teamId: teamIdBySlug[slug],
      totalPoints: 120 - i * 6, finalPlacement: withPlacement ? i + 1 : null,
    })),
  });
  return t;
}

async function main() {
  console.log("Очищаю таблицы…");
  await prisma.playerGameStat.deleteMany();
  await prisma.teamGameResult.deleteMany();
  await prisma.game.deleteMany();
  await prisma.match.deleteMany();
  await prisma.groupTeam.deleteMany();
  await prisma.group.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.championshipPoint.deleteMany();
  await prisma.roster.deleteMany();
  await prisma.tournamentParticipant.deleteMany();
  await prisma.stream.deleteMany();
  await prisma.externalRef.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.split.deleteMany();
  await prisma.season.deleteMany();

  console.log(`Создаю ${TEAMS.length} команд и составы…`);
  for (const t of TEAMS) {
    const team = await prisma.team.create({
      data: { slug: t.slug, name: t.name, tag: t.tag, region: t.region },
    });
    teamIdBySlug[t.slug] = team.id;
    const handles = t.players ?? [genHandle(), genHandle(), genHandle()];
    teamPlayerIds[t.slug] = [];
    for (let i = 0; i < handles.length; i++) {
      const handle = handles[i];
      const player = await prisma.player.create({
        data: { slug: handle.toLowerCase(), handle, role: i === 0 ? "IGL" : null },
      });
      playerIdByHandle[handle] = player.id;
      teamPlayerIds[t.slug].push(player.id);
      await prisma.roster.create({
        data: { teamId: team.id, playerId: player.id, startDate: new Date(now - 180 * DAY) },
      });
    }
  }

  // ===== Standalone ALGS: Year 4 Championship (завершён) =====
  console.log("ALGS Year 4 Championship…");
  const champs = await prisma.tournament.create({
    data: {
      slug: "algs-y4-championship", name: "ALGS Year 4 Championship", region: "Global",
      tier: "official", series: "ALGS", eventType: "CHAMPIONSHIP", format: "MATCH_POINT",
      organizer: "EA / Respawn", status: "COMPLETED",
      startDate: new Date(now - 200 * DAY), endDate: new Date(now - 198 * DAY),
      descriptionEn: "The crowning event of the Apex Legends Global Series Year 4.",
      descriptionRu: "Главный турнир четвёртого года Apex Legends Global Series.",
    },
  });
  const champsStage = await prisma.stage.create({
    data: { tournamentId: champs.id, name: "Finals", format: "MATCH_POINT", order: 1 },
  });
  const champsMatch = await prisma.match.create({
    data: { tournamentId: champs.id, stageId: champsStage.id, label: "Match Day 1 — Finals", status: "COMPLETED", order: 1, scheduledAt: new Date(now - 198 * DAY) },
  });
  const champsPoints: Record<string, number> = {};
  await createGameWithStats(champsMatch.id, 1, "World's Edge", "COMPLETED", new Date(now - 198 * DAY), [
    { team: "tsm", placement: 1, kills: 8 }, { team: "darkzero", placement: 2, kills: 10 },
    { team: "nrg", placement: 3, kills: 5 }, { team: "alliance", placement: 4, kills: 3 },
  ], champsPoints);
  await createGameWithStats(champsMatch.id, 2, "Storm Point", "COMPLETED", new Date(now - 198 * DAY + 3600_000), [
    { team: "nrg", placement: 1, kills: 9 }, { team: "tsm", placement: 2, kills: 6 },
    { team: "alliance", placement: 3, kills: 7 }, { team: "darkzero", placement: 4, kills: 4 },
  ], champsPoints);
  await writeParticipants(champs.id, champsPoints, true);
  await prisma.stream.create({
    data: { channelName: "apexlegends", type: "OFFICIAL", title: "ALGS Championship — Official", language: "en", tournamentId: champs.id, matchId: champsMatch.id, isLive: false },
  });

  // ===== Standalone ALGS: Pro League EMEA (идёт сейчас) — даёт live-матч и стримы на главную =====
  console.log("ALGS Pro League — EMEA (live)…");
  const proLeague = await prisma.tournament.create({
    data: {
      slug: "algs-proleague-emea-live", name: "ALGS Pro League — EMEA", region: "EMEA",
      tier: "official", series: "ALGS", eventType: "PRO_LEAGUE", format: "ROUND_ROBIN",
      organizer: "EA / Respawn", status: "LIVE",
      startDate: new Date(now - 1 * DAY), endDate: new Date(now + 2 * DAY),
      descriptionEn: "Regional pro league, EMEA.", descriptionRu: "Региональная про-лига, EMEA.",
    },
  });
  const proStage = await prisma.stage.create({
    data: { tournamentId: proLeague.id, name: "Regular Season", format: "ROUND_ROBIN", order: 1 },
  });
  const liveMatch = await prisma.match.create({
    data: { tournamentId: proLeague.id, stageId: proStage.id, label: "Week 3 — Day 2", status: "LIVE", order: 1, scheduledAt: new Date(now - 3600_000), endsAt: new Date(now + 3 * 3600_000) },
  });
  const proPoints: Record<string, number> = {};
  await createGameWithStats(liveMatch.id, 1, "E-District", "COMPLETED", new Date(now - 3000_000), [
    { team: "alliance", placement: 1, kills: 11 }, { team: "falcons", placement: 2, kills: 7 },
    { team: "gaimin", placement: 3, kills: 6 }, { team: "aurora", placement: 4, kills: 5 },
  ], proPoints);
  await writeParticipants(proLeague.id, proPoints, false);
  await prisma.match.create({
    data: { tournamentId: proLeague.id, stageId: proStage.id, label: "Week 3 — Day 3", status: "UPCOMING", order: 2, scheduledAt: new Date(now + 2 * DAY) },
  });
  await prisma.stream.create({
    data: { channelName: "apexlegends", type: "OFFICIAL", title: "Pro League — Official Broadcast", language: "en", tournamentId: proLeague.id, matchId: liveMatch.id, isLive: true },
  });
  await prisma.stream.create({
    data: { channelName: "hardecki", type: "PLAYER_POV", title: "Hardecki POV", language: "en", matchId: liveMatch.id, playerId: playerIdByHandle["Hardecki"], teamId: teamIdBySlug["alliance"], isLive: true },
  });
  await prisma.stream.create({
    data: { channelName: "effect", type: "PLAYER_POV", title: "Effect POV", language: "en", matchId: liveMatch.id, playerId: playerIdByHandle["Effect"], teamId: teamIdBySlug["falcons"], isLive: true },
  });

  // ===== Сезон ALGS 2026-27 (полный пайплайн) =====
  console.log("Сезон ALGS 2026-27…");
  const season = await prisma.season.create({
    data: {
      slug: "algs-2026-27", name: "ALGS 2026-27", series: "ALGS", organizer: "EA / Respawn",
      startDate: new Date(now - 90 * DAY), endDate: new Date(now + 210 * DAY),
    },
  });
  const split1 = await prisma.split.create({
    data: { seasonId: season.id, slug: "algs-2627-split-1", name: "Split 1", order: 1 },
  });
  const split2 = await prisma.split.create({
    data: { seasonId: season.id, slug: "algs-2627-split-2", name: "Split 2", order: 2 },
  });
  const REGIONS = ["Americas", "EMEA", "APAC North", "APAC South"];

  // --- Детальный Americas Pro League (Split 1): 3 группы по 10, triple round-robin + Regional Final ---
  console.log("  Split 1 · Americas Pro League (детально)…");
  const americas = slugsByRegion("Americas"); // 30 команд
  const proLeagueA = await prisma.tournament.create({
    data: {
      slug: "algs-2627-s1-proleague-americas", name: "Split 1 Pro League — Americas", region: "Americas",
      tier: "official", series: "ALGS", eventType: "PRO_LEAGUE", format: "LEAGUE",
      organizer: "EA / Respawn", status: "COMPLETED", seasonId: season.id, splitId: split1.id,
      startDate: new Date(now - 60 * DAY), endDate: new Date(now - 40 * DAY),
      descriptionRu: "Регулярный сезон: 30 команд, 3 группы по 10, тройной round-robin (Match Series по 6 игр), затем Regional Final (Match Point).",
      descriptionEn: "Regular season: 30 teams, 3 groups of 10, triple round-robin (6-game Match Series), then a Regional Final (Match Point).",
    },
  });
  const regSeason = await prisma.stage.create({
    data: { tournamentId: proLeagueA.id, name: "Regular Season", format: "ROUND_ROBIN", order: 1 },
  });
  const groupDefs = [
    { name: "Group A", slugs: americas.slice(0, 10) },
    { name: "Group B", slugs: americas.slice(10, 20) },
    { name: "Group C", slugs: americas.slice(20, 30) },
  ];
  const groupIds: Record<string, string> = {};
  for (let gi = 0; gi < groupDefs.length; gi++) {
    const g = await prisma.group.create({
      data: { stageId: regSeason.id, name: groupDefs[gi].name, order: gi + 1 },
    });
    groupIds[groupDefs[gi].name] = g.id;
    await prisma.groupTeam.createMany({
      data: groupDefs[gi].slugs.map((slug, i) => ({ groupId: g.id, teamId: teamIdBySlug[slug], seed: i + 1 })),
    });
  }
  // Кросс-групповые серии (A×B, A×C, B×C), по 2 игры на серию (представительно; в реале 6).
  const lgPoints: Record<string, number> = {};
  const gsMaps = ["World's Edge", "Storm Point", "E-District", "Broken Moon", "Olympus", "Kings Canyon"];
  const pairs: [string, string][] = [["Group A", "Group B"], ["Group A", "Group C"], ["Group B", "Group C"]];
  let mapIdx = 0;
  for (let s = 0; s < pairs.length; s++) {
    const lobby = [...groupDefs.find((g) => g.name === pairs[s][0])!.slugs, ...groupDefs.find((g) => g.name === pairs[s][1])!.slugs];
    const seriesMatch = await prisma.match.create({
      data: { tournamentId: proLeagueA.id, stageId: regSeason.id, label: `Match Series ${s + 1} — ${pairs[s][0]} vs ${pairs[s][1]}`, status: "COMPLETED", order: s + 1, scheduledAt: new Date(now - (58 - s * 3) * DAY) },
    });
    for (let g = 0; g < 2; g++) {
      await createGameWithStats(seriesMatch.id, g + 1, gsMaps[mapIdx % gsMaps.length], "COMPLETED", new Date(now - (58 - s * 3) * DAY + g * 3600_000), syntheticGame(lobby, s * 2 + g + 1), lgPoints);
      mapIdx++;
    }
  }
  // Regional Final (Match Point) — топ-20 по очкам регулярки.
  const top20 = Object.entries(lgPoints).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([s]) => s);
  const finalStage = await prisma.stage.create({
    data: { tournamentId: proLeagueA.id, name: "Regional Final", format: "MATCH_POINT", order: 2 },
  });
  const finalMatch = await prisma.match.create({
    data: { tournamentId: proLeagueA.id, stageId: finalStage.id, label: "Regional Final — Match Point", status: "COMPLETED", order: 10, scheduledAt: new Date(now - 41 * DAY) },
  });
  for (let g = 0; g < 3; g++) {
    await createGameWithStats(finalMatch.id, g + 1, gsMaps[g], "COMPLETED", new Date(now - 41 * DAY + g * 3600_000), syntheticGame(top20, g + 2), lgPoints);
  }
  await writeParticipants(proLeagueA.id, lgPoints, true);
  // Очки чемпионата за Americas Pro League.
  const champRank = Object.entries(lgPoints).sort((a, b) => b[1] - a[1]);
  const CHAMP_PTS = [10, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 1, 1];
  await prisma.championshipPoint.createMany({
    data: champRank.slice(0, CHAMP_PTS.length).map(([slug], i) => ({
      seasonId: season.id, teamId: teamIdBySlug[slug], tournamentId: proLeagueA.id,
      points: CHAMP_PTS[i], note: "Split 1 Pro League (Americas)",
    })),
  });

  // --- Полный пайплайн (лёгкие события) по сплитам и регионам ---
  // Тиры внутри сплита: Challenger Circuit → Online Open → Pro League Qualifier → Pro League.
  const tiers: { key: EvType; nameRu: string; fmt: Fmt; offset: number }[] = [
    { key: "CHALLENGER_CIRCUIT", nameRu: "Challenger Circuit", fmt: "SINGLE_LOBBY", offset: 0 },
    { key: "ONLINE_OPEN", nameRu: "Online Open", fmt: "SINGLE_LOBBY", offset: 8 },
    { key: "PRO_LEAGUE_QUALIFIER", nameRu: "Pro League Qualifier", fmt: "MATCH_POINT", offset: 16 },
    { key: "PRO_LEAGUE", nameRu: "Pro League", fmt: "LEAGUE", offset: 24 },
  ];

  async function buildSplitPipeline(
    split: { id: string; slug: string }, base: number,
    tierStatus: (offset: number) => Status, playoffsStatus: Status, playoffsOffset: number,
    playoffsCity: string,
  ) {
    for (const region of REGIONS) {
      const pool = slugsByRegion(region).slice(0, 10);
      for (const tier of tiers) {
        // Детальный Americas Pro League уже создан выше — пропускаем его дубль.
        if (region === "Americas" && tier.key === "PRO_LEAGUE" && split.slug === "algs-2627-split-1") continue;
        const startOffset = base + tier.offset;
        await createLightTournament({
          slug: `${split.slug}-${tier.key.toLowerCase()}-${region.replace(/\s+/g, "-").toLowerCase()}`,
          name: `${tier.nameRu} — ${region}`,
          region, status: tierStatus(startOffset), organizer: "EA / Respawn",
          series: "ALGS", format: tier.fmt, eventType: tier.key,
          seasonId: season.id, splitId: split.id,
          startOffsetDays: startOffset, endOffsetDays: startOffset + 4,
          teamSlugs: pool,
        });
      }
    }
    // Split Playoffs — общий LAN.
    await createLightTournament({
      slug: `${split.slug}-playoffs`, name: `Split Playoffs — ${playoffsCity}`, region: "Global",
      status: playoffsStatus, organizer: "EA / Respawn", series: "ALGS", format: "MATCH_POINT",
      eventType: "SPLIT_PLAYOFFS", seasonId: season.id, splitId: split.id,
      startOffsetDays: playoffsOffset, endOffsetDays: playoffsOffset + 4,
      teamSlugs: ["tsm", "nrg", "alliance", "falcons", "fnatic", "reignite", "chained", "aurora"],
      descriptionRu: "LAN-плейофф сплита: команды из всех регионов.",
      descriptionEn: "Split LAN playoffs: teams from every region.",
    });
  }

  console.log("  Split 1 · пайплайн…");
  await buildSplitPipeline(split1, -84, () => "COMPLETED", "COMPLETED", -30, "Paris");
  console.log("  Split 2 · пайплайн…");
  // Split 2 идёт сейчас: circuit/open/qualifier завершены, pro league — live, playoffs — впереди.
  await buildSplitPipeline(
    split2, -20,
    (offset) => (offset < -2 ? "COMPLETED" : offset < 6 ? "LIVE" : "UPCOMING"),
    "UPCOMING", 30, "Las Vegas",
  );

  // --- Уровень сезона: LCQ по регионам + Championship ---
  console.log("  LCQ + Championship…");
  for (const region of REGIONS) {
    await createLightTournament({
      slug: `algs-2627-lcq-${region.replace(/\s+/g, "-").toLowerCase()}`,
      name: `Last Chance Qualifier — ${region}`, region, status: "UPCOMING",
      organizer: "EA / Respawn", series: "ALGS", format: "MATCH_POINT", eventType: "LCQ",
      seasonId: season.id, startOffsetDays: 55, endOffsetDays: 57,
      teamSlugs: slugsByRegion(region).slice(0, 8),
      descriptionRu: "Последний шанс квалифицироваться в Чемпионат.",
      descriptionEn: "Last chance to qualify for the Championship.",
    });
  }
  await createLightTournament({
    slug: "algs-2027-championship", name: "ALGS 2027 Championship — Sapporo", region: "Global",
    status: "UPCOMING", organizer: "EA / Respawn", series: "ALGS", format: "MATCH_POINT",
    eventType: "CHAMPIONSHIP", seasonId: season.id, startOffsetDays: 90, endOffsetDays: 94,
    teamSlugs: ["tsm", "nrg", "alliance", "falcons", "fnatic", "reignite", "chained", "aurora", "darkzero", "disguised"],
    descriptionRu: "Финал сезона ALGS 2026-27 — Саппоро, Япония.",
    descriptionEn: "The ALGS 2026-27 season finale — Sapporo, Japan.",
  });

  // ===== Прочие (не-ALGS) турниры для каталога =====
  console.log("Прочие турниры (каталог)…");
  await createLightTournament({
    slug: "apac-invitational-spring", name: "APAC Spring Invitational", region: "APAC North",
    status: "COMPLETED", startOffsetDays: -20, endOffsetDays: -18, organizer: "Community",
    teamSlugs: ["reignite", "fnatic", "riddle", "northeption"],
    descriptionRu: "Весенний пригласительный турнир APAC.", descriptionEn: "APAC spring invitational.",
  });
  await createLightTournament({
    slug: "na-summer-brawl", name: "NA Summer Brawl", region: "Americas",
    status: "UPCOMING", startOffsetDays: 3, endOffsetDays: 4, organizer: "Community",
    teamSlugs: ["tsm", "nrg", "darkzero", "disguised", "sentinels"],
    descriptionRu: "Летний любительский турнир, Северная Америка.", descriptionEn: "Amateur summer tournament, North America.",
  });
  await createLightTournament({
    slug: "emea-community-cup", name: "EMEA Community Cup", region: "EMEA",
    status: "COMPLETED", startOffsetDays: -14, endOffsetDays: -13, organizer: "Community",
    teamSlugs: ["gaimin", "alliance", "falcons", "liquid"],
    descriptionRu: "Любительский кубок сообщества EMEA.", descriptionEn: "EMEA community cup (amateur).",
  });
  await createLightTournament({
    slug: "esports-arena-winter", name: "Esports Arena Winter Cup", region: "Americas",
    status: "COMPLETED", startOffsetDays: -35, endOffsetDays: -34, organizer: "Esports Arena",
    teamSlugs: ["nrg", "tsm", "disguised", "darkzero"],
    descriptionRu: "Зимний кубок, Северная Америка.", descriptionEn: "Winter cup, North America.",
  });

  const counts = {
    seasons: await prisma.season.count(),
    splits: await prisma.split.count(),
    tournaments: await prisma.tournament.count(),
    algsTournaments: await prisma.tournament.count({ where: { series: "ALGS" } }),
    teams: await prisma.team.count(),
    matches: await prisma.match.count(),
    games: await prisma.game.count(),
    championshipPoints: await prisma.championshipPoint.count(),
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
