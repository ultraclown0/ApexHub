import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAlgsSeasons, getAlgsStandaloneTournaments } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegionTag } from "@/components/region-tag";
import { FormatBadge } from "@/components/format-badge";

export const dynamic = "force-dynamic";

export default async function AlgsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Algs");
  const tf = await getTranslations("Format");

  const [seasons, standalone] = await Promise.all([
    getAlgsSeasons(),
    getAlgsStandaloneTournaments(),
  ]);

  const empty = seasons.length === 0 && standalone.length === 0;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle")}</p>

      {empty ? (
        <p className="mt-8 text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-8 space-y-10">
          {/* Сезоны (лиги) */}
          {seasons.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("seasons")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {seasons.map((s) => (
                  <Link key={s.id} href={`/seasons/${s.slug}`}>
                    <Card className="h-full transition hover:border-primary/40">
                      <CardHeader>
                        <CardTitle className="text-base">{s.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>
                          {s._count.splits} {t("splits")}
                        </span>
                        <span>
                          {s._count.tournaments} {t("events")}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Отдельные ALGS-турниры (вне сезонов) */}
          {standalone.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">{t("standalone")}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {standalone.map((tr) => (
                  <Link key={tr.id} href={`/tournaments/${tr.slug}`}>
                    <Card className="h-full transition hover:border-primary/40">
                      <CardHeader>
                        <CardTitle className="text-base">{tr.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {tr.region && <RegionTag region={tr.region} />}
                        <FormatBadge format={tr.format} label={tf(tr.format)} />
                        <span>
                          {tr._count.participants} {t("teams")}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
