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
        <div className="space-y-10">
          {/* Сводная таблица: команды × игры + итог */}
          {summary.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("stats")}</h2>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{t("table.place")}</TableHead>
                      <TableHead className="min-w-32">{t("table.team")}</TableHead>
                      {gameNumbers.map((n) => (
                        <TableHead
                          key={n}
                          className="text-center"
                          title={gameMapByNumber.get(n) ?? undefined}
                        >
                          {t("game")} {n}
                        </TableHead>
                      ))}
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
                        <TableCell className="whitespace-nowrap">
                          <Link
                            href={`/teams/${row.slug}`}
                            className="hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        {gameNumbers.map((n) => (
                          <TableCell
                            key={n}
                            className="text-center tabular-nums text-muted-foreground"
                          >
                            {row.places[n] ?? "—"}
                          </TableCell>
                        ))}
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
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {gameNumbers
                  .map((n) => `${t("game")} ${n}: ${gameMapByNumber.get(n) ?? "—"}`)
                  .join(" · ")}
              </p>
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
