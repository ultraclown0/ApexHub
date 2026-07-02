import { prisma } from "@/lib/prisma";
import { createTournament, createSeason } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground";
const label = "flex flex-col gap-1 text-sm";
const btn =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";

export default async function AdminHome() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { matches: true } } },
  });
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { splits: true, tournaments: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Сезоны / лиги */}
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Сезоны / лиги</h1>
      <ul className="mb-6 divide-y rounded-md border">
        {seasons.length === 0 && (
          <li className="px-4 py-3 text-muted-foreground">Пока нет сезонов.</li>
        )}
        {seasons.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3">
            <a
              href={`/admin/seasons/${s.id}`}
              className="font-medium hover:underline"
            >
              {s.name}
            </a>
            <span className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{s._count.splits} сплит.</span>
              <span>{s._count.tournaments} соб.</span>
            </span>
          </li>
        ))}
      </ul>
      <section className="mb-12 rounded-md border p-5">
        <h2 className="mb-4 text-lg font-semibold">Новый сезон</h2>
        <form action={createSeason} className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Название*
            <input name="name" required placeholder="ALGS Year 6" className={input} />
          </label>
          <label className={label}>
            Организатор
            <input name="organizer" placeholder="EA / Respawn" className={input} />
          </label>
          <label className={label}>
            Серия
            <input name="series" placeholder="ALGS (пусто = прочее)" className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              Начало
              <input type="date" name="startDate" className={input} />
            </label>
            <label className={label}>
              Конец
              <input type="date" name="endDate" className={input} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={btn}>
              Создать сезон
            </button>
          </div>
        </form>
      </section>

      <h1 className="mb-6 text-2xl font-bold tracking-tight">Турниры</h1>

      {/* Список турниров */}
      <ul className="mb-10 divide-y rounded-md border">
        {tournaments.length === 0 && (
          <li className="px-4 py-3 text-muted-foreground">Пока нет турниров.</li>
        )}
        {tournaments.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <a
              href={`/admin/tournaments/${t.id}`}
              className="font-medium hover:underline"
            >
              {t.name}
            </a>
            <span className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{t.status}</span>
              <span>{t._count.matches} матч.</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Создание турнира */}
      <section className="rounded-md border p-5">
        <h2 className="mb-4 text-lg font-semibold">Новый турнир</h2>
        <form action={createTournament} className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Название*
            <input name="name" required className={input} />
          </label>
          <label className={label}>
            Slug (необяз.)
            <input name="slug" placeholder="авто из названия" className={input} />
          </label>
          <label className={label}>
            Регион
            <input name="region" placeholder="EMEA / NA / APAC / Global" className={input} />
          </label>
          <label className={label}>
            Серия
            <input name="series" placeholder="ALGS (пусто = прочее)" className={input} />
          </label>
          <label className={label}>
            Формат
            <select name="format" defaultValue="SINGLE_LOBBY" className={input}>
              <option value="SINGLE_LOBBY">SINGLE_LOBBY</option>
              <option value="MATCH_POINT">MATCH_POINT</option>
              <option value="ROUND_ROBIN">ROUND_ROBIN</option>
              <option value="BRACKET">BRACKET</option>
              <option value="LEAGUE">LEAGUE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label className={label}>
            Тип события
            <select name="eventType" defaultValue="none" className={input}>
              <option value="none">—</option>
              <option value="CHALLENGER_CIRCUIT">CHALLENGER_CIRCUIT</option>
              <option value="ONLINE_OPEN">ONLINE_OPEN</option>
              <option value="PRO_LEAGUE_QUALIFIER">PRO_LEAGUE_QUALIFIER</option>
              <option value="PRO_LEAGUE">PRO_LEAGUE</option>
              <option value="SPLIT_PLAYOFFS">SPLIT_PLAYOFFS</option>
              <option value="LCQ">LCQ</option>
              <option value="CHAMPIONSHIP">CHAMPIONSHIP</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label className={label}>
            Статус
            <select name="status" defaultValue="UPCOMING" className={input}>
              <option value="UPCOMING">UPCOMING</option>
              <option value="LIVE">LIVE</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              Начало
              <input type="date" name="startDate" className={input} />
            </label>
            <label className={label}>
              Конец
              <input type="date" name="endDate" className={input} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Создать турнир
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
