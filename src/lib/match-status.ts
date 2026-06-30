// Определение статуса матча по расписанию (без Twitch API).
//
// Логика:
//  - если статус выставлен вручную в админке (statusLocked) — используем его как есть;
//  - CANCELLED всегда уважается;
//  - иначе вычисляем по времени: до начала → UPCOMING, внутри окна → LIVE, после → COMPLETED.
// Окно = [scheduledAt, endsAt]. Если endsAt пуст — берём start + дефолтную длительность.

export type MatchStatus = "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELLED";

// Матч-день по Apex обычно длится ~4 часа. Используется, когда конец не задан явно.
export const DEFAULT_MATCH_DURATION_MS = 4 * 60 * 60 * 1000;

type MatchTiming = {
  scheduledAt: Date | null;
  endsAt: Date | null;
  status: string;
  statusLocked: boolean;
};

// Эффективный конец окна: явный endsAt, либо start + дефолтная длительность.
export function effectiveMatchEnd(m: {
  scheduledAt: Date | null;
  endsAt: Date | null;
}): Date | null {
  if (m.endsAt) return m.endsAt;
  if (m.scheduledAt)
    return new Date(m.scheduledAt.getTime() + DEFAULT_MATCH_DURATION_MS);
  return null;
}

export function effectiveMatchStatus(
  m: MatchTiming,
  now: Date = new Date(),
): MatchStatus {
  if (m.statusLocked) return m.status as MatchStatus;
  if (m.status === "CANCELLED") return "CANCELLED";
  if (!m.scheduledAt) return m.status as MatchStatus; // без времени вычислять нечего

  const t = now.getTime();
  const start = m.scheduledAt.getTime();
  const end = effectiveMatchEnd(m)!.getTime();

  if (t < start) return "UPCOMING";
  if (t <= end) return "LIVE";
  return "COMPLETED";
}
