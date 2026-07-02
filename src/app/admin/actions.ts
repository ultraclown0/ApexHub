"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function str(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function date(formData: FormData, key: string) {
  const v = str(formData, key);
  return v ? new Date(v) : null;
}

const STATUSES = ["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];
const asStatus = (v: string): Status =>
  (STATUSES as readonly string[]).includes(v) ? (v as Status) : "UPCOMING";

const STREAM_TYPES = ["OFFICIAL", "PLAYER_POV", "CASTER", "WATCH_PARTY"] as const;
type StreamType = (typeof STREAM_TYPES)[number];
const asStreamType = (v: string): StreamType =>
  (STREAM_TYPES as readonly string[]).includes(v)
    ? (v as StreamType)
    : "OFFICIAL";

const FORMATS = [
  "SINGLE_LOBBY",
  "MATCH_POINT",
  "ROUND_ROBIN",
  "BRACKET",
  "LEAGUE",
  "OTHER",
] as const;
type Format = (typeof FORMATS)[number];
const asFormat = (v: string): Format =>
  (FORMATS as readonly string[]).includes(v) ? (v as Format) : "SINGLE_LOBBY";

const EVENT_TYPES = [
  "CHALLENGER_CIRCUIT", "ONLINE_OPEN", "PRO_LEAGUE_QUALIFIER", "PRO_LEAGUE",
  "SPLIT_PLAYOFFS", "LCQ", "CHAMPIONSHIP", "OTHER",
] as const;
type EvType = (typeof EVENT_TYPES)[number];
// Пусто/none → null; иначе валидируем.
const asEventType = (v: string): EvType | null =>
  v && (EVENT_TYPES as readonly string[]).includes(v) ? (v as EvType) : null;

function num(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// «none» / пусто → null (для необязательных связей в select'ах).
function orNull(v: string): string | null {
  return v && v !== "none" ? v : null;
}

export async function createTournament(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const slug = str(formData, "slug") || slugify(name);
  await prisma.tournament.create({
    data: {
      name,
      slug,
      region: str(formData, "region") || null,
      series: str(formData, "series") || null,
      eventType: asEventType(str(formData, "eventType")),
      format: asFormat(str(formData, "format")),
      status: asStatus(str(formData, "status")),
      startDate: date(formData, "startDate"),
      endDate: date(formData, "endDate"),
    },
  });
  revalidatePath("/admin");
}

export async function updateTournamentStatus(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;
  await prisma.tournament.update({
    where: { id },
    data: { status: asStatus(str(formData, "status")) },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/tournaments/${id}`);
}

// Привязать турнир к его ID в DGS (apexlegendsstatus.com) — источник статистики.
// ID виден в адресе на сайте DGS: /tournament/results/<ID>/... . Пусто = отвязать.
export async function setDgsTournamentId(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;
  const dgsId = str(formData, "dgsId");

  // Сначала убираем прежнюю привязку этого турнира (если была).
  await prisma.externalRef.deleteMany({
    where: { source: "dgs", entityType: "tournament", entityId: id },
  });
  if (dgsId) {
    await prisma.externalRef.upsert({
      where: {
        source_entityType_externalId: {
          source: "dgs",
          entityType: "tournament",
          externalId: dgsId,
        },
      },
      create: { source: "dgs", entityType: "tournament", entityId: id, externalId: dgsId },
      update: { entityId: id },
    });
  }
  revalidatePath(`/admin/tournaments/${id}`);
}

export async function createMatch(formData: FormData) {
  const tournamentId = str(formData, "tournamentId");
  const label = str(formData, "label");
  if (!tournamentId || !label) return;
  const count = await prisma.match.count({ where: { tournamentId } });
  await prisma.match.create({
    data: {
      tournamentId,
      label,
      scheduledAt: date(formData, "scheduledAt"),
      endsAt: date(formData, "endsAt"),
      order: count + 1,
    },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

// Ручное управление матчем: расписание и/или закреплённый статус.
// Если «Закрепить статус» не отмечено — статус вычисляется по расписанию автоматически.
export async function updateMatch(formData: FormData) {
  const id = str(formData, "id");
  const tournamentId = str(formData, "tournamentId");
  if (!id) return;
  const statusLocked = formData.get("statusLocked") === "on";
  await prisma.match.update({
    where: { id },
    data: {
      scheduledAt: date(formData, "scheduledAt"),
      endsAt: date(formData, "endsAt"),
      statusLocked,
      ...(statusLocked ? { status: asStatus(str(formData, "status")) } : {}),
    },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
  revalidatePath("/", "layout");
}

// ===== Лиги: сезоны / сплиты / стадии / группы / очки чемпионата =====

export async function createSeason(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  await prisma.season.create({
    data: {
      name,
      slug: str(formData, "slug") || slugify(name),
      series: str(formData, "series") || null,
      organizer: str(formData, "organizer") || null,
      startDate: date(formData, "startDate"),
      endDate: date(formData, "endDate"),
    },
  });
  revalidatePath("/admin");
}

export async function createSplit(formData: FormData) {
  const seasonId = str(formData, "seasonId");
  const name = str(formData, "name");
  if (!seasonId || !name) return;
  const count = await prisma.split.count({ where: { seasonId } });
  await prisma.split.create({
    data: {
      seasonId,
      name,
      slug: str(formData, "slug") || slugify(`${seasonId}-${name}`),
      order: num(formData, "order") ?? count + 1,
    },
  });
  revalidatePath(`/admin/seasons/${seasonId}`);
}

// Привязка турнира к лиге (сезон/сплит) и его формат.
export async function updateTournamentLeague(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;
  await prisma.tournament.update({
    where: { id },
    data: {
      format: asFormat(str(formData, "format")),
      series: str(formData, "series") || null,
      eventType: asEventType(str(formData, "eventType")),
      seasonId: orNull(str(formData, "seasonId")),
      splitId: orNull(str(formData, "splitId")),
    },
  });
  revalidatePath(`/admin/tournaments/${id}`);
  revalidatePath("/", "layout");
}

export async function createStage(formData: FormData) {
  const tournamentId = str(formData, "tournamentId");
  const name = str(formData, "name");
  if (!tournamentId || !name) return;
  const count = await prisma.stage.count({ where: { tournamentId } });
  const fmt = str(formData, "format");
  await prisma.stage.create({
    data: {
      tournamentId,
      name,
      format: fmt && fmt !== "none" ? asFormat(fmt) : null,
      order: num(formData, "order") ?? count + 1,
    },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function createGroup(formData: FormData) {
  const stageId = str(formData, "stageId");
  const tournamentId = str(formData, "tournamentId");
  const name = str(formData, "name");
  if (!stageId || !name) return;
  const count = await prisma.group.count({ where: { stageId } });
  await prisma.group.create({
    data: { stageId, name, order: num(formData, "order") ?? count + 1 },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function assignTeamToGroup(formData: FormData) {
  const groupId = str(formData, "groupId");
  const teamId = str(formData, "teamId");
  const tournamentId = str(formData, "tournamentId");
  if (!groupId || !teamId) return;
  await prisma.groupTeam.upsert({
    where: { groupId_teamId: { groupId, teamId } },
    create: { groupId, teamId, seed: num(formData, "seed") },
    update: { seed: num(formData, "seed") },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

// Назначить матч на стадию/группу (или снять — «none»).
export async function assignMatch(formData: FormData) {
  const id = str(formData, "id");
  const tournamentId = str(formData, "tournamentId");
  if (!id) return;
  await prisma.match.update({
    where: { id },
    data: {
      stageId: orNull(str(formData, "stageId")),
      groupId: orNull(str(formData, "groupId")),
    },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}

export async function addChampionshipPoints(formData: FormData) {
  const seasonId = str(formData, "seasonId");
  const teamId = str(formData, "teamId");
  const points = num(formData, "points");
  if (!seasonId || !teamId || points == null) return;
  await prisma.championshipPoint.create({
    data: {
      seasonId,
      teamId,
      tournamentId: orNull(str(formData, "tournamentId")),
      points,
      note: str(formData, "note") || null,
    },
  });
  revalidatePath(`/admin/seasons/${seasonId}`);
}

export async function addStream(formData: FormData) {
  const tournamentId = str(formData, "tournamentId");
  const matchId = str(formData, "matchId");
  const channelName = str(formData, "channelName");
  if (!matchId || !channelName) return;
  await prisma.stream.create({
    data: {
      channelName,
      type: asStreamType(str(formData, "type")),
      title: str(formData, "title") || null,
      language: str(formData, "language") || null,
      matchId,
      tournamentId: tournamentId || null,
    },
  });
  revalidatePath(`/admin/tournaments/${tournamentId}`);
}
