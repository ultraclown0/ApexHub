import { prisma } from "./db";
import { RateLimiter } from "./throttle";

// Базовый URL DGS «Ingram» — настраивается через env (на случай смены пути).
const DGS_BASE =
  process.env.DGS_API_BASE ?? "https://apexlegendsstatus.com/tournament/api";

// ~2 запроса в секунду по условиям некоммерческой лицензии.
const limiter = new RateLimiter(550);

type Json = Record<string, unknown>;

async function dgsGet(endpoint: string, params: Record<string, string> = {}) {
  await limiter.wait();
  const token = process.env.DGS_API_TOKEN!;
  const qs = new URLSearchParams(params).toString();
  const url = `${DGS_BASE}/${endpoint}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    // Точное имя заголовка уточняется по документации DGS; токен в заголовке.
    headers: { Authorization: token, "X-API-Key": token },
  });
  if (!res.ok) throw new Error(`DGS ${endpoint}: ${res.status}`);
  return res.json();
}

// Безопасно достаёт первое непустое поле из набора возможных имён.
function pick(obj: Json, names: string[]): string | undefined {
  for (const n of names) {
    const v = obj[n];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Связывает нашу запись с внешним id (идемпотентность).
async function linkExternal(
  entityType: string,
  entityId: string,
  externalId: string,
) {
  await prisma.externalRef.upsert({
    where: {
      source_entityType_externalId: {
        source: "dgs",
        entityType,
        externalId,
      },
    },
    create: { source: "dgs", entityType, entityId, externalId },
    update: { entityId },
  });
}

export async function ingestDgs() {
  const raw = (await dgsGet("getTournaments")) as Json;

  // РЕЖИМ РАЗВЕДКИ: при первом запуске с реальным токеном печатаем форму
  // ответа, чтобы по ней довести точный маппинг полей.
  const list: Json[] = Array.isArray(raw)
    ? (raw as Json[])
    : Array.isArray(raw.tournaments)
      ? (raw.tournaments as Json[])
      : Array.isArray(raw.data)
        ? (raw.data as Json[])
        : [];

  if (list.length === 0) {
    console.log("DGS: ответ получен, но список турниров пуст. Форма ответа:");
    console.log(JSON.stringify(raw).slice(0, 600));
    return { tournaments: 0, note: "empty or unknown shape — see log" };
  }

  console.log(`DGS: получено турниров: ${list.length}.`);
  console.log("DGS: поля первого турнира:", Object.keys(list[0]).join(", "));

  // Базовый upsert турниров (название/даты/регион). Игры и счёт (getGames /
  // getScores) подключим, сверив точные поля по этому же ответу.
  let upserted = 0;
  for (const item of list) {
    const externalId = pick(item, ["id", "tournamentId", "tournament_id", "uuid"]);
    const name = pick(item, ["name", "title", "tournamentName"]);
    if (!externalId || !name) continue;

    const existing = await prisma.externalRef.findUnique({
      where: {
        source_entityType_externalId: {
          source: "dgs",
          entityType: "tournament",
          externalId,
        },
      },
    });

    const data = {
      name,
      region: pick(item, ["region", "regionName"]) ?? null,
    };

    if (existing) {
      await prisma.tournament.update({ where: { id: existing.entityId }, data });
    } else {
      const created = await prisma.tournament.create({
        data: { ...data, slug: `${slugify(name)}-${externalId}` },
      });
      await linkExternal("tournament", created.id, externalId);
    }
    upserted++;
  }

  return { tournaments: upserted };
}
