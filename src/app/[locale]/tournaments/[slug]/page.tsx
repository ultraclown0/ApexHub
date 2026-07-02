import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTournamentBySlug } from "@/lib/queries";
import { standingsFromMatches, type StandingRow } from "@/lib/standings";
import { Link } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegionTag } from "@/components/region-tag";
import { FormatBadge } from "@/components/format-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Labels = {
  place: string;
  team: string;
  gamesShort: string;
  wins: string;
  kills: string;
  points: string;
  avgPlace: string;
};

// Таблица standings, посчитанная из результатов игр.
function StandingsTable({ rows, labels }: { rows: StandingRow[]; labels: Labels }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">{labels.place}</TableHead>
          <TableHead>{labels.team}</TableHead>
          <TableHead className="text-center">{labels.gamesShort}</TableHead>
          <TableHead className="text-center">{labels.wins}</TableHead>
          <TableHead className="text-center">{labels.kills}</TableHead>
          <TableHead className="text-center">{labels.points}</TableHead>
          <TableHead className="text-center">{labels.avgPlace}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={row.teamId}>
            <TableCell className="font-medium">{i + 1}</TableCell>
            <TableCell>
              <Link href={`/teams/${row.slug}`} className="hover:underline">
                {row.name}
              </Link>
            </TableCell>
            <TableCell className="text-center tabular-nums text-muted-foreground">
              {row.games}
            </TableCell>
            <TableCell className="text-center tabular-nums text-muted-foreground">
              {row.wins}
            </TableCell>
            <TableCell className="text-center tabular-nums">{row.kills}</TableCell>
            <TableCell className="text-center font-medium tabular-nums">
              {row.points}
            </TableCell>
            <TableCell className="text-center tabular-nums text-muted-foreground">
              {row.avgPlacement != null ? row.avgPlacement.toFixed(1) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TournamentDetail");
  const tf = await getTranslations("Format");
  const te = await getTranslations("EventType");
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) notFound();

  const description =
    locale === "ru" ? tournament.descriptionRu : tournament.descriptionEn;

  const labels: Labels = {
    place: t("place"),
    team: t("team"),
    gamesShort: t("gamesShort"),
    wins: t("wins"),
    kills: t("kills"),
    points: t("points"),
    avgPlace: t("avgPlace"),
  };

  // Матчи по стадиям (для вкладок «Таблица» и «Матчи»).
  const matchesByStage = new Map<string, typeof tournament.matches>();
  const noStageMatches: typeof tournament.matches = [];
  for (const m of tournament.matches) {
    if (m.stageId) {
      const arr = matchesByStage.get(m.stageId) ?? [];
      arr.push(m);
      matchesByStage.set(m.stageId, arr);
    } else {
      noStageMatches.push(m);
    }
  }

  const overall = standingsFromMatches(tournament.matches);
  const hasStages = tournament.stages.length > 0;
  const hasGameData = overall.length > 0;

  return (
    <>
      {tournament.season && (
        <Link
          href={`/seasons/${tournament.season.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {tournament.season.name}
          {tournament.split ? ` · ${tournament.split.name}` : ""}
        </Link>
      )}
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{tournament.name}</h1>
      {tournament.eventType && (
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-primary/80">
          {te(tournament.eventType)}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tournament.region && <RegionTag region={tournament.region} />}
        <FormatBadge format={tournament.format} label={tf(tournament.format)} />
      </div>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}

      <Tabs defaultValue="standings" className="mt-8">
        <TabsList>
          <TabsTrigger value="standings">{t("standings")}</TabsTrigger>
          <TabsTrigger value="matches">{t("matches")}</TabsTrigger>
          <TabsTrigger value="participants">{t("participants")}</TabsTrigger>
        </TabsList>

        {/* Турнирная таблица: по стадиям/группам, иначе — итоговая */}
        <TabsContent value="standings" className="mt-6 space-y-10">
          {hasStages && hasGameData ? (
            tournament.stages.map((stage) => {
              const stageMatches = matchesByStage.get(stage.id) ?? [];
              return (
                <section key={stage.id}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{stage.name}</h2>
                    {stage.format && (
                      <FormatBadge
                        format={stage.format}
                        label={tf(stage.format)}
                      />
                    )}
                  </div>
                  {stage.groups.length > 0 ? (
                    <div className="space-y-6">
                      {stage.groups.map((group) => {
                        const allowed = new Set(
                          group.teams.map((gt) => gt.team.id),
                        );
                        const rows = standingsFromMatches(stageMatches, allowed);
                        return (
                          <div key={group.id}>
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                              {group.name}
                            </h3>
                            <StandingsTable rows={rows} labels={labels} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <StandingsTable
                      rows={standingsFromMatches(stageMatches)}
                      labels={labels}
                    />
                  )}
                </section>
              );
            })
          ) : hasGameData ? (
            <StandingsTable rows={overall} labels={labels} />
          ) : tournament.participants.length > 0 ? (
            // Фолбэк: нет пер-гейм данных — показываем итоговые места участников.
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t("place")}</TableHead>
                  <TableHead>{t("team")}</TableHead>
                  <TableHead className="text-right">{t("points")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournament.participants.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.finalPlacement ?? i + 1}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/teams/${p.team.slug}`}
                        className="hover:underline"
                      >
                        {p.team.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.totalPoints ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t("noStandings")}</p>
          )}
        </TabsContent>

        {/* Матчи, сгруппированные по стадиям */}
        <TabsContent value="matches" className="mt-6 space-y-8">
          {tournament.matches.length === 0 ? (
            <p className="text-muted-foreground">{t("noMatches")}</p>
          ) : (
            <>
              {tournament.stages.map((stage) => {
                const stageMatches = matchesByStage.get(stage.id) ?? [];
                if (stageMatches.length === 0) return null;
                return (
                  <section key={stage.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{stage.name}</h2>
                      {stage.format && (
                        <FormatBadge
                          format={stage.format}
                          label={tf(stage.format)}
                        />
                      )}
                    </div>
                    <MatchList matches={stageMatches} gamesLabel={t("games")} />
                  </section>
                );
              })}
              {noStageMatches.length > 0 && (
                <section>
                  {hasStages && (
                    <h2 className="mb-3 text-lg font-semibold">{t("noStage")}</h2>
                  )}
                  <MatchList matches={noStageMatches} gamesLabel={t("games")} />
                </section>
              )}
            </>
          )}
        </TabsContent>

        {/* Участники */}
        <TabsContent value="participants" className="mt-6">
          {tournament.participants.length === 0 ? (
            <p className="text-muted-foreground">{t("noParticipants")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tournament.participants.map((p) => (
                <div key={p.id} className="rounded-md border p-4">
                  <Link
                    href={`/teams/${p.team.slug}`}
                    className="font-semibold hover:underline"
                  >
                    {p.team.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.team.rosterSpots.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/players/${spot.player.slug}`}
                        className="rounded border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                      >
                        {spot.player.handle}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

// Список матчей (в рамках стадии или без неё).
function MatchList({
  matches,
  gamesLabel,
}: {
  matches: Array<{
    id: string;
    label: string;
    group: { name: string } | null;
    _count: { games: number };
  }>;
  gamesLabel: string;
}) {
  return (
    <ul className="divide-y rounded-md border">
      {matches.map((m) => (
        <li key={m.id}>
          <Link
            href={`/matches/${m.id}`}
            className="flex items-center justify-between px-4 py-3 transition hover:bg-muted/50"
          >
            <span className="font-medium">
              {m.label}
              {m.group && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.group.name}
                </span>
              )}
            </span>
            <span className="text-sm text-muted-foreground">
              {m._count.games} {gamesLabel}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
