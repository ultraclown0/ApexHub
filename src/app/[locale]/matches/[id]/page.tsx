import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMatchById } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { MultiPovGrid } from "@/components/multi-pov-grid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

// Медальки для призовых мест: золото / серебро / бронза. Цветной квадрат-подложка,
// текст не перекрашиваем в цвет медали (тёмный — только для читаемости на фоне).
const MEDAL: Record<number, string> = {
  1: "bg-yellow-400 text-black",
  2: "bg-slate-300 text-black",
  3: "bg-amber-600 text-black",
};

function Placement({ place }: { place: number | null }) {
  if (place == null) return <>—</>;
  const medal = MEDAL[place];
  if (!medal) return <>{place}</>;
  return (
    <span
      className={`inline-flex size-[1lh] items-center justify-center rounded ${medal}`}
    >
      {place}
    </span>
  );
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Match");
  const match = await getMatchById(id);

  if (!match) notFound();

  // Сводная таблица: команды (строки) × игры (столбцы: место в каждой игре)
  // + итоговые киллы и очки за весь матч.
  const games = match.games; // уже отсортированы по gameNumber (хронология)
  const gameMapByNumber = new Map(games.map((g) => [g.gameNumber, g.map]));
  const rowsMap = new Map<
    string,
    {
      name: string;
      slug: string;
      places: Record<number, number | null>;
      kills: number;
      points: number;
    }
  >();
  for (const game of games) {
    for (const r of game.teamResults) {
      const row = rowsMap.get(r.teamId) ?? {
        name: r.team.name,
        slug: r.team.slug,
        places: {},
        kills: 0,
        points: 0,
      };
      row.places[game.gameNumber] = r.placement ?? null;
      row.kills += r.kills;
      row.points += r.totalPoints;
      rowsMap.set(r.teamId, row);
    }
  }
  const summary = [...rowsMap.values()].sort((a, b) => b.points - a.points);
  const gameNumbers = games.map((g) => g.gameNumber);

  // Топ по киллам за весь матч (суммарно по всем играм).
  const fragMap = new Map<
    string,
    { handle: string; slug: string; teamTag: string; teamSlug: string; kills: number; damage: number }
  >();
  for (const game of match.games) {
    for (const s of game.playerStats) {
      const cur = fragMap.get(s.playerId) ?? {
        handle: s.player.handle,
        slug: s.player.slug,
        teamTag: s.team.tag ?? s.team.name,
        teamSlug: s.team.slug,
        kills: 0,
        damage: 0,
      };
      cur.kills += s.kills;
      cur.damage += s.damageDealt;
      fragMap.set(s.playerId, cur);
    }
  }
  const topFraggers = [...fragMap.values()]
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 10);

  return (
    <>
      <Link
        href={`/tournaments/${match.tournament.slug}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {match.tournament.name}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{match.label}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* ===== Слева: Multi-POV сетка ===== */}
        <section className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 text-xl font-semibold">{t("streams")}</h2>
          {match.streams.length === 0 ? (
            <p className="text-muted-foreground">{t("noStreams")}</p>
          ) : (
            <>
              <MultiPovGrid
                streams={match.streams}
                officialLabel={t("official")}
                povLabel={t("playerPov")}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("soundHint")}
              </p>
            </>
          )}
        </section>

        {/* ===== Справа: статистика ===== */}
        <div className="min-w-0 space-y-10">
          {/* Сводная таблица: команды × игры + итог */}
          {summary.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("stats")}</h2>
              <div className="rounded-md border [&_[data-slot=table-container]]:rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-20 w-10 min-w-10 max-w-10 bg-background">
                        {t("table.place")}
                      </TableHead>
                      <TableHead className="sticky left-10 z-20 w-40 min-w-40 max-w-40 bg-background">
                        {t("table.team")}
                      </TableHead>
                      <TableHead className="sticky left-[200px] z-20 w-16 min-w-16 max-w-16 bg-background text-center">
                        {t("table.kills")}
                      </TableHead>
                      <TableHead className="sticky left-[264px] z-20 w-16 min-w-16 max-w-16 bg-background text-center shadow-[inset_-1px_0_0_0_var(--border)]">
                        {t("table.points")}
                      </TableHead>
                      {gameNumbers.map((n) => (
                        <TableHead key={n} className="text-center">
                          <span className="flex flex-col items-center leading-tight">
                            <span>
                              {t("game")} {n}
                            </span>
                            {gameMapByNumber.get(n) && (
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {gameMapByNumber.get(n)}
                              </span>
                            )}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((row, i) => (
                      <TableRow key={row.slug}>
                        <TableCell className="sticky left-0 z-10 w-10 min-w-10 max-w-10 bg-background font-medium">
                          {i + 1}
                        </TableCell>
                        <TableCell className="sticky left-10 z-10 w-40 min-w-40 max-w-40 bg-background">
                          <Link
                            href={`/teams/${row.slug}`}
                            title={row.name}
                            className="block truncate hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell className="sticky left-[200px] z-10 w-16 min-w-16 max-w-16 bg-background text-center tabular-nums">
                          {row.kills}
                        </TableCell>
                        <TableCell className="sticky left-[264px] z-10 w-16 min-w-16 max-w-16 bg-background text-center font-medium tabular-nums shadow-[inset_-1px_0_0_0_var(--border)]">
                          {row.points}
                        </TableCell>
                        {gameNumbers.map((n) => (
                          <TableCell
                            key={n}
                            className="text-center tabular-nums text-muted-foreground"
                          >
                            <Placement place={row.places[n] ?? null} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Топ по киллам за матч (суммарно) */}
          {topFraggers.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("topFraggers")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("player")}</TableHead>
                    <TableHead>{t("table.team")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.kills")}
                    </TableHead>
                    <TableHead className="text-right">{t("damage")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFraggers.map((s) => (
                    <TableRow key={s.slug}>
                      <TableCell className="font-medium">
                        <Link href={`/players/${s.slug}`} className="hover:underline">
                          {s.handle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link href={`/teams/${s.teamSlug}`} className="hover:underline">
                          {s.teamTag}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.kills}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.damage}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
