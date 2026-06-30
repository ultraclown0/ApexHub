import { prisma } from "@/lib/prisma";
import { createTournament } from "./actions";

export const dynamic = "force-dynamic";

const input =
  "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground";
const label = "flex flex-col gap-1 text-sm";

export default async function AdminHome() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { matches: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
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
