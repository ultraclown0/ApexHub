import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSeasonBySlug } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegionTag } from "@/components/region-tag";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Seasons");
  const te = await getTranslations("EventType");
  const data = await getSeasonBySlug(slug);

  if (!data) notFound();
  const { season, championship } = data;

  // События по сплитам (+ уровень сезона: LCQ / Championship — без сплита).
  const splitGroups = season.splits.map((split) => ({
    split,
    events: season.tournaments.filter((x) => x.splitId === split.id),
  }));
  const noSplit = season.tournaments.filter((x) => !x.splitId);

  // Порядок регионов как в ALGS; неизвестные — в конце.
  const REGION_ORDER = ["Americas", "NA", "EMEA", "APAC North", "APAC South", "APAC", "Global"];
  const regionRank = (r: string | null) => {
    const i = REGION_ORDER.indexOf(r ?? "");
    return i === -1 ? REGION_ORDER.length : i;
  };

  // Порядок типов событий в пайплайне (снизу вверх).
  const EVENT_ORDER = [
    "CHALLENGER_CIRCUIT", "ONLINE_OPEN", "PRO_LEAGUE_QUALIFIER", "PRO_LEAGUE",
    "SPLIT_PLAYOFFS", "LCQ", "CHAMPIONSHIP", "OTHER",
  ];
  const eventRank = (e: string | null) => {
    const i = EVENT_ORDER.indexOf(e ?? "");
    return i === -1 ? EVENT_ORDER.length : i;
  };
  const byPipeline = (evs: typeof season.tournaments) =>
    [...evs].sort(
      (a, b) =>
        eventRank(a.eventType) - eventRank(b.eventType) ||
        (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0),
    );

  const cards = (events: typeof season.tournaments) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {byPipeline(events).map((ev) => (
        <Link key={ev.id} href={`/tournaments/${ev.slug}`}>
          <Card className="h-full transition hover:border-primary/40">
            <CardHeader>
              {ev.eventType && (
                <div className="text-xs font-medium uppercase tracking-wide text-primary/80">
                  {te(ev.eventType)}
                </div>
              )}
              <CardTitle className="text-base">{ev.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {ev.region && <RegionTag region={ev.region} />}
              <span>
                {ev._count.participants} {t("teams")}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );

  // События сплита, сгруппированные по региону (Americas → EMEA → APAC → Global).
  const renderEvents = (events: typeof season.tournaments) => {
    const byRegion = new Map<string, typeof season.tournaments>();
    for (const ev of events) {
      const key = ev.region ?? "—";
      const arr = byRegion.get(key) ?? [];
      arr.push(ev);
      byRegion.set(key, arr);
    }
    const regions = [...byRegion.keys()].sort(
      (a, b) => regionRank(a === "—" ? null : a) - regionRank(b === "—" ? null : b),
    );
    // Если регион один — не дробим на подзаголовки.
    if (regions.length <= 1) return cards(events);
    return (
      <div className="space-y-5">
        {regions.map((region) => (
          <div key={region}>
            {region !== "—" && (
              <div className="mb-2">
                <RegionTag region={region} />
              </div>
            )}
            {cards(byRegion.get(region)!)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Link
        href="/algs"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← ALGS
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{season.name}</h1>
      {season.organizer && (
        <p className="mt-2 text-muted-foreground">{season.organizer}</p>
      )}

      {/* Очки чемпионата */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("championship")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          {t("championshipHint")}
        </p>
        {championship.length === 0 ? (
          <p className="text-muted-foreground">{t("noChampionship")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">{t("rank")}</TableHead>
                <TableHead>{t("team")}</TableHead>
                <TableHead className="text-right">{t("points")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {championship.map((row, i) => (
                <TableRow key={row.team.id}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/teams/${row.team.slug}`}
                      className="hover:underline"
                    >
                      {row.team.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* События по сплитам */}
      <section className="mt-10 space-y-8">
        <h2 className="text-xl font-semibold">{t("eventsTitle")}</h2>
        {season.tournaments.length === 0 ? (
          <p className="text-muted-foreground">{t("noEvents")}</p>
        ) : (
          <>
            {splitGroups.map(
              ({ split, events }) =>
                events.length > 0 && (
                  <div key={split.id}>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {split.name}
                    </h3>
                    {renderEvents(events)}
                  </div>
                ),
            )}
            {noSplit.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("seasonLevel")}
                </h3>
                {renderEvents(noSplit)}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
