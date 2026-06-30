import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getTournaments,
  getPlayerLeaderboard,
  getTeamLeaderboard,
} from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { StatsControls } from "@/components/stats-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Stats");

  const tournamentId =
    typeof sp.tournament === "string" ? sp.tournament : undefined;

  const [tournaments, players, teams] = await Promise.all([
    getTournaments(),
    getPlayerLeaderboard(tournamentId),
    getTeamLeaderboard(tournamentId),
  ]);

  const playersSorted = [...players]
    .sort((a, b) => b.kills - a.kills)
    .slice(0, 20);
  const teamsSorted = [...teams].sort((a, b) => b.points - a.points).slice(0, 20);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <StatsControls
          tournaments={tournaments.map((x) => ({ id: x.id, name: x.name }))}
        />
      </div>

      <Tabs defaultValue="players">
        <TabsList>
          <TabsTrigger value="players">{t("players")}</TabsTrigger>
          <TabsTrigger value="teams">{t("teams")}</TabsTrigger>
        </TabsList>

        {/* Лидерборд игроков */}
        <TabsContent value="players" className="mt-6">
          {playersSorted.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{t("rank")}</TableHead>
                  <TableHead>{t("player")}</TableHead>
                  <TableHead>{t("team")}</TableHead>
                  <TableHead className="text-right">{t("games")}</TableHead>
                  <TableHead className="text-right">{t("kills")}</TableHead>
                  <TableHead className="text-right">{t("assists")}</TableHead>
                  <TableHead className="text-right">{t("damage")}</TableHead>
                  <TableHead className="text-right">
                    {t("killsPerGame")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playersSorted.map((row, i) => (
                  <TableRow key={row.player.id}>
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/players/${row.player.slug}`}
                        className="hover:underline"
                      >
                        {row.player.handle}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.team ? (
                        <Link
                          href={`/teams/${row.team.slug}`}
                          className="hover:underline"
                        >
                          {row.team.tag ?? row.team.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.games}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.kills}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.assists}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.damage}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.avgKills.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Лидерборд команд */}
        <TabsContent value="teams" className="mt-6">
          {teamsSorted.length === 0 ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">{t("rank")}</TableHead>
                  <TableHead>{t("team")}</TableHead>
                  <TableHead className="text-right">{t("games")}</TableHead>
                  <TableHead className="text-right">{t("wins")}</TableHead>
                  <TableHead className="text-right">{t("kills")}</TableHead>
                  <TableHead className="text-right">{t("avgPlace")}</TableHead>
                  <TableHead className="text-right">{t("points")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamsSorted.map((row, i) => (
                  <TableRow key={row.team.id}>
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/teams/${row.team.slug}`}
                        className="hover:underline"
                      >
                        {row.team.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.games}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.wins}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.kills}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.avgPlacement != null
                        ? row.avgPlacement.toFixed(1)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {row.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
