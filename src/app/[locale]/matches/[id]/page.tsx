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

  // Итог матча: сумма очков и киллов по командам за все игры.
  const summaryMap = new Map<
    string,
    { name: string; slug: string; kills: number; points: number }
  >();
  for (const game of match.games) {
    for (const r of game.teamResults) {
      const cur = summaryMap.get(r.teamId) ?? {
        name: r.team.name,
        slug: r.team.slug,
        kills: 0,
        points: 0,
      };
      cur.kills += r.kills;
      cur.points += r.totalPoints;
      summaryMap.set(r.teamId, cur);
    }
  }
  const summary = [...summaryMap.values()].sort((a, b) => b.points - a.points);

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
        <div className="space-y-10">
          {/* Итог матча */}
          {summary.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("stats")}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">{t("table.place")}</TableHead>
                    <TableHead>{t("table.team")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.kills")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("table.points")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row, i) => (
                    <TableRow key={row.slug}>
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>
                        <Link
                          href={`/teams/${row.slug}`}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.kills}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.points}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}

          {/* Результаты по играм */}
          {match.games.map((game) => (
            <section key={game.id}>
              <h3 className="mb-1 font-semibold">
                {t("game")} {game.gameNumber}
                {game.map && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {game.map}
                  </span>
                )}
              </h3>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">{t("table.place")}</TableHead>
                    <TableHead>{t("table.team")}</TableHead>
                    <TableHead className="text-right">
                      {t("table.kills")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("table.points")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {game.teamResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.placement}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/teams/${r.team.slug}`}
                          className="hover:underline"
                        >
                          {r.team.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.kills}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {r.totalPoints}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Топ по киллам */}
              <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("topFraggers")}
              </h4>
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
                  {game.playerStats.slice(0, 5).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/players/${s.player.slug}`}
                          className="hover:underline"
                        >
                          {s.player.handle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Link
                          href={`/teams/${s.team.slug}`}
                          className="hover:underline"
                        >
                          {s.team.tag ?? s.team.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.kills}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.damageDealt}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
