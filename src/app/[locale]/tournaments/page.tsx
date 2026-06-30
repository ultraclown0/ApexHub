import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTournaments } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TournamentFilters } from "@/components/tournament-filters";
import { RegionTag } from "@/components/region-tag";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["LIVE", "UPCOMING", "COMPLETED", "CANCELLED"] as const;

function uniqueSorted(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}

export default async function TournamentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Tournaments");

  const all = await getTournaments();

  // Опции фильтров из данных.
  const regions = uniqueSorted(all.map((x) => x.region));
  const seasons = uniqueSorted(
    all.map((x) => (x.startDate ? String(x.startDate.getFullYear()) : null)),
  ).reverse();

  const pick = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";
  const region = pick("region");
  const season = pick("season");

  const filtered = all.filter(
    (x) =>
      (!region || x.region === region) &&
      (!season ||
        (x.startDate && x.startDate.getFullYear() === Number(season))),
  );

  const groups = STATUS_ORDER.map((status) => ({
    status,
    items: filtered.filter((x) => x.status === status),
  })).filter((g) => g.items.length > 0);

  // Число колонок = число непустых групп (статические классы — иначе Tailwind их не увидит).
  const COLS: Record<number, string> = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <TournamentFilters regions={regions} seasons={seasons} />
      </div>

      {all.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">{t("noMatch")}</p>
      ) : (
        <div className={`grid grid-cols-1 gap-6 ${COLS[groups.length]}`}>
          {groups.map((group) => (
            <section key={group.status}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`status.${group.status}`)}
              </h2>
              <div className="flex flex-col gap-3">
                {group.items.map((tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/tournaments/${tournament.slug}`}
                  >
                    <Card className="h-full transition hover:border-primary/40">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {tournament.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {tournament.region && (
                          <RegionTag region={tournament.region} />
                        )}
                        <span>
                          {tournament._count.participants} {t("teams")}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
