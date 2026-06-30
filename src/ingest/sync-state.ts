import { prisma } from "./db";

// Фиксирует результат синхронизации источника (для мониторинга и курсоров).
export async function recordSync(
  source: string,
  endpoint: string,
  status: "ok" | "error",
  note?: string,
) {
  await prisma.syncState.upsert({
    where: { source_endpoint: { source, endpoint } },
    create: { source, endpoint, status, note, lastRunAt: new Date() },
    update: { status, note, lastRunAt: new Date() },
  });
}
