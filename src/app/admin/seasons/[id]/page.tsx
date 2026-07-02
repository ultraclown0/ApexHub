import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSplit, addChampionshipPoints } from "../../actions";

export const dynamic = "force-dynamic";

const input =
  "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground";
const label = "flex flex-col gap-1 text-sm";
const btn =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";

export default async function AdminSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const season = await prisma.season.findUnique({
    where: { id },
    include: {
      splits: { orderBy: { order: "asc" } },
      tournaments: { orderBy: { startDate: "asc" } },
      championshipPoints: {
        include: { team: true },
        orderBy: { points: "desc" },
      },
    },
  });
  if (!season) notFound();

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <a
        href="/admin"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Админка
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{season.name}</h1>

      {/* Сплиты */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Сплиты</h2>
        <ul className="mb-4 divide-y rounded-md border">
          {season.splits.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">Пока нет сплитов.</li>
          )}
          {season.splits.map((sp) => (
            <li key={sp.id} className="px-4 py-3 text-sm font-medium">
              {sp.name}
            </li>
          ))}
        </ul>
        <form
          action={createSplit}
          className="flex flex-wrap items-end gap-2 rounded-md border p-4"
        >
          <input type="hidden" name="seasonId" value={season.id} />
          <label className={`${label} flex-1`}>
            Название сплита*
            <input name="name" required placeholder="Split 1" className={input} />
          </label>
          <label className={label}>
            Порядок
            <input type="number" name="order" className={`${input} w-24`} />
          </label>
          <button type="submit" className={btn}>
            Добавить сплит
          </button>
        </form>
      </section>

      {/* Очки чемпионата */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Очки чемпионата</h2>
        <ul className="mb-4 divide-y rounded-md border">
          {season.championshipPoints.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">
              Пока нет начислений.
            </li>
          )}
          {season.championshipPoints.map((cp) => (
            <li
              key={cp.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium">{cp.team.name}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {cp.note && <span>{cp.note}</span>}
                <span className="font-medium text-foreground tabular-nums">
                  {cp.points}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <form
          action={addChampionshipPoints}
          className="flex flex-wrap items-end gap-2 rounded-md border p-4"
        >
          <input type="hidden" name="seasonId" value={season.id} />
          <label className={label}>
            Команда*
            <select name="teamId" required className={input}>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Событие (необяз.)
            <select name="tournamentId" className={input}>
              <option value="none">—</option>
              {season.tournaments.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Очки*
            <input
              type="number"
              name="points"
              required
              className={`${input} w-24`}
            />
          </label>
          <label className={`${label} flex-1`}>
            Заметка
            <input name="note" placeholder="Split 1 Pro League" className={input} />
          </label>
          <button type="submit" className={btn}>
            Начислить
          </button>
        </form>
      </section>

      {/* События сезона */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">События сезона</h2>
        <ul className="divide-y rounded-md border">
          {season.tournaments.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">
              Привяжите турнир к сезону на его странице в админке.
            </li>
          )}
          {season.tournaments.map((tr) => (
            <li key={tr.id} className="px-4 py-3 text-sm">
              <a
                href={`/admin/tournaments/${tr.id}`}
                className="font-medium hover:underline"
              >
                {tr.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
