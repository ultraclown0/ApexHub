import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createMatch,
  updateMatch,
  addStream,
  updateTournamentStatus,
  setDgsTournamentId,
  updateTournamentLeague,
  createStage,
  createGroup,
  assignTeamToGroup,
  assignMatch,
} from "../../actions";
import { effectiveMatchStatus } from "@/lib/match-status";

const FORMATS = [
  "SINGLE_LOBBY",
  "MATCH_POINT",
  "ROUND_ROBIN",
  "BRACKET",
  "LEAGUE",
  "OTHER",
] as const;

const EVENT_TYPES = [
  "CHALLENGER_CIRCUIT",
  "ONLINE_OPEN",
  "PRO_LEAGUE_QUALIFIER",
  "PRO_LEAGUE",
  "SPLIT_PLAYOFFS",
  "LCQ",
  "CHAMPIONSHIP",
  "OTHER",
] as const;

export const dynamic = "force-dynamic";

const input =
  "rounded-md border bg-background px-3 py-1.5 text-sm text-foreground";
const label = "flex flex-col gap-1 text-sm";
const btn =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90";

// Для <input type="datetime-local"> нужен формат YYYY-MM-DDTHH:mm.
function forInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 16);
}

export default async function AdminTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { order: "asc" },
        include: {
          stage: true,
          group: true,
          _count: { select: { games: true, streams: true } },
        },
      },
      stages: {
        orderBy: { order: "asc" },
        include: {
          groups: {
            orderBy: { order: "asc" },
            include: { teams: { include: { team: true } } },
          },
        },
      },
      streams: true,
    },
  });
  if (!tournament) notFound();

  // Текущая привязка к DGS (если есть).
  const dgsRef = await prisma.externalRef.findFirst({
    where: { source: "dgs", entityType: "tournament", entityId: tournament.id },
  });

  // Справочники для форм.
  const seasons = await prisma.season.findMany({
    orderBy: { startDate: "desc" },
    include: { splits: { orderBy: { order: "asc" } } },
  });
  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  // Плоский список групп «Стадия — Группа» для привязки матчей.
  const allGroups = tournament.stages.flatMap((s) =>
    s.groups.map((g) => ({ id: g.id, label: `${s.name} — ${g.name}` })),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <a
        href="/admin"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Все турниры
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {tournament.name}
      </h1>

      {/* Статус */}
      <form
        action={updateTournamentStatus}
        className="mt-4 flex items-end gap-2"
      >
        <input type="hidden" name="id" value={tournament.id} />
        <label className={label}>
          Статус
          <select name="status" defaultValue={tournament.status} className={input}>
            <option value="UPCOMING">UPCOMING</option>
            <option value="LIVE">LIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>
        <button type="submit" className={btn}>
          Сохранить
        </button>
      </form>

      {/* Привязка к DGS (источник статистики) */}
      <form action={setDgsTournamentId} className="mt-4 flex items-end gap-2">
        <input type="hidden" name="id" value={tournament.id} />
        <label className={`${label} flex-1`}>
          DGS ID турнира
          <input
            name="dgsId"
            defaultValue={dgsRef?.externalId ?? ""}
            placeholder="напр. 4737 (из адреса на apexlegendsstatus.com)"
            className={input}
          />
        </label>
        <button type="submit" className={btn}>
          Привязать
        </button>
      </form>
      <p className="mt-2 text-sm text-muted-foreground">
        {dgsRef
          ? `Привязан к DGS #${dgsRef.externalId}. Запустите «npm run ingest dgs», чтобы обновить статистику.`
          : "Укажите ID турнира из адреса на apexlegendsstatus.com, чтобы тянуть его статистику."}
      </p>

      {/* Лига и формат */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Лига и формат</h2>
        <form
          action={updateTournamentLeague}
          className="flex flex-wrap items-end gap-2 rounded-md border p-4"
        >
          <input type="hidden" name="id" value={tournament.id} />
          <label className={label}>
            Серия
            <input
              name="series"
              defaultValue={tournament.series ?? ""}
              placeholder="ALGS (пусто = прочее)"
              className={input}
            />
          </label>
          <label className={label}>
            Формат
            <select name="format" defaultValue={tournament.format} className={input}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Тип события
            <select
              name="eventType"
              defaultValue={tournament.eventType ?? "none"}
              className={input}
            >
              <option value="none">—</option>
              {EVENT_TYPES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Сезон
            <select
              name="seasonId"
              defaultValue={tournament.seasonId ?? "none"}
              className={input}
            >
              <option value="none">— без сезона —</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Сплит
            <select
              name="splitId"
              defaultValue={tournament.splitId ?? "none"}
              className={input}
            >
              <option value="none">— без сплита —</option>
              {seasons.flatMap((s) =>
                s.splits.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {s.name} — {sp.name}
                  </option>
                )),
              )}
            </select>
          </label>
          <button type="submit" className={btn}>
            Сохранить
          </button>
        </form>
        <p className="mt-2 text-sm text-muted-foreground">
          Сплит должен принадлежать выбранному сезону.
        </p>
      </section>

      {/* Стадии и группы */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Стадии и группы</h2>
        <div className="mb-4 space-y-4">
          {tournament.stages.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока нет стадий.</p>
          )}
          {tournament.stages.map((stage) => (
            <div key={stage.id} className="rounded-md border p-4">
              <div className="mb-2 text-sm font-medium">
                {stage.name}
                {stage.format && (
                  <span className="ml-2 text-muted-foreground">
                    {stage.format}
                  </span>
                )}
              </div>

              {/* Группы стадии */}
              <ul className="mb-3 space-y-2">
                {stage.groups.map((g) => (
                  <li key={g.id} className="rounded border px-3 py-2 text-sm">
                    <div className="font-medium">{g.name}</div>
                    <div className="mt-1 text-muted-foreground">
                      {g.teams.length === 0
                        ? "команды не назначены"
                        : g.teams.map((gt) => gt.team.name).join(", ")}
                    </div>
                    <form
                      action={assignTeamToGroup}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="groupId" value={g.id} />
                      <input
                        type="hidden"
                        name="tournamentId"
                        value={tournament.id}
                      />
                      <select name="teamId" required className={input}>
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        name="seed"
                        placeholder="сид"
                        className={`${input} w-20`}
                      />
                      <button type="submit" className={btn}>
                        В группу
                      </button>
                    </form>
                  </li>
                ))}
              </ul>

              {/* Добавить группу в стадию */}
              <form
                action={createGroup}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="stageId" value={stage.id} />
                <input
                  type="hidden"
                  name="tournamentId"
                  value={tournament.id}
                />
                <input
                  name="name"
                  required
                  placeholder="Group A"
                  className={input}
                />
                <button type="submit" className={btn}>
                  Добавить группу
                </button>
              </form>
            </div>
          ))}
        </div>

        {/* Добавить стадию */}
        <form
          action={createStage}
          className="flex flex-wrap items-end gap-2 rounded-md border p-4"
        >
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <label className={`${label} flex-1`}>
            Название стадии*
            <input
              name="name"
              required
              placeholder="Group Stage / Regional Finals"
              className={input}
            />
          </label>
          <label className={label}>
            Формат
            <select name="format" defaultValue="none" className={input}>
              <option value="none">—</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn}>
            Добавить стадию
          </button>
        </form>
      </section>

      {/* Матчи */}
      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">Матчи</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Статус вычисляется по времени (начало → конец). Отметьте «Закрепить»,
          чтобы задать статус вручную, если график поехал.
        </p>
        <ul className="mb-4 space-y-3">
          {tournament.matches.length === 0 && (
            <li className="rounded-md border px-4 py-3 text-muted-foreground">
              Пока нет матчей.
            </li>
          )}
          {tournament.matches.map((m) => {
            const eff = effectiveMatchStatus(m);
            return (
              <li key={m.id} className="rounded-md border p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">
                      {eff}
                      {m.statusLocked ? " 🔒" : " (авто)"}
                    </span>
                    <span>{m._count.games} игр</span>
                    <span>{m._count.streams} стрим.</span>
                  </span>
                </div>
                <form
                  action={updateMatch}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="tournamentId"
                    value={tournament.id}
                  />
                  <label className={label}>
                    Начало
                    <input
                      type="datetime-local"
                      name="scheduledAt"
                      defaultValue={forInput(m.scheduledAt)}
                      className={input}
                    />
                  </label>
                  <label className={label}>
                    Конец
                    <input
                      type="datetime-local"
                      name="endsAt"
                      defaultValue={forInput(m.endsAt)}
                      className={input}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="statusLocked"
                      defaultChecked={m.statusLocked}
                    />
                    Закрепить
                  </label>
                  <label className={label}>
                    Статус (вручную)
                    <select
                      name="status"
                      defaultValue={m.status}
                      className={input}
                    >
                      <option value="UPCOMING">UPCOMING</option>
                      <option value="LIVE">LIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </label>
                  <button type="submit" className={btn}>
                    Сохранить
                  </button>
                </form>

                {tournament.stages.length > 0 && (
                  <form
                    action={assignMatch}
                    className="mt-2 flex flex-wrap items-end gap-2 border-t pt-2"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <input
                      type="hidden"
                      name="tournamentId"
                      value={tournament.id}
                    />
                    <label className={label}>
                      Стадия
                      <select
                        name="stageId"
                        defaultValue={m.stageId ?? "none"}
                        className={input}
                      >
                        <option value="none">—</option>
                        {tournament.stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={label}>
                      Группа
                      <select
                        name="groupId"
                        defaultValue={m.groupId ?? "none"}
                        className={input}
                      >
                        <option value="none">—</option>
                        {allGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className={btn}>
                      Привязать
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        <form
          action={createMatch}
          className="flex flex-wrap items-end gap-2 rounded-md border p-4"
        >
          <input type="hidden" name="tournamentId" value={tournament.id} />
          <label className={`${label} flex-1`}>
            Название матча*
            <input
              name="label"
              required
              placeholder="Day 1 — Group A"
              className={input}
            />
          </label>
          <label className={label}>
            Начало
            <input type="datetime-local" name="scheduledAt" className={input} />
          </label>
          <label className={label}>
            Конец
            <input type="datetime-local" name="endsAt" className={input} />
          </label>
          <button type="submit" className={btn}>
            Добавить матч
          </button>
        </form>
      </section>

      {/* Трансляции */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Трансляции (Twitch)</h2>
        <ul className="mb-4 divide-y rounded-md border">
          {tournament.streams.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">
              Пока нет привязанных трансляций.
            </li>
          )}
          {tournament.streams.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium">
                {s.title ?? s.channelName}{" "}
                <span className="text-muted-foreground">@{s.channelName}</span>
              </span>
              <span className="text-muted-foreground">{s.type}</span>
            </li>
          ))}
        </ul>
        {tournament.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Сначала добавьте матч — стрим привязывается к матчу.
          </p>
        ) : (
          <form
            action={addStream}
            className="flex flex-wrap items-end gap-2 rounded-md border p-4"
          >
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <label className={label}>
              Матч*
              <select name="matchId" required className={input}>
                {tournament.matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Twitch-канал*
              <input
                name="channelName"
                required
                placeholder="imperialhal"
                className={input}
              />
            </label>
            <label className={label}>
              Тип
              <select name="type" defaultValue="OFFICIAL" className={input}>
                <option value="OFFICIAL">OFFICIAL</option>
                <option value="PLAYER_POV">PLAYER_POV</option>
                <option value="CASTER">CASTER</option>
                <option value="WATCH_PARTY">WATCH_PARTY</option>
              </select>
            </label>
            <label className={`${label} flex-1`}>
              Название (необяз.)
              <input name="title" placeholder="ImperialHal POV" className={input} />
            </label>
            <button type="submit" className={btn}>
              Привязать
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
