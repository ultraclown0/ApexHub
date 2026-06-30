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

export async function createTournament(formData: FormData) {
  const name = str(formData, "name");
  if (!name) return;
  const slug = str(formData, "slug") || slugify(name);
  await prisma.tournament.create({
    data: {
      name,
      slug,
      region: str(formData, "region") || null,
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
