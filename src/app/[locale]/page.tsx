import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RegionTag } from "@/components/region-tag";
import {
  getLiveMatches,
  getUpcomingMatches,
  getRecentMatches,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

// Победитель матча — команда с наибольшей суммой очков по всем играм.
function matchWinner(match: Awaited<ReturnType<typeof getRecentMatches>>[number]) {
  const totals = new Map<string, { name: string; points: number }>();
  for (const g of match.games) {
    for (const r of g.teamResults) {
      const cur = totals.get(r.teamId) ?? { name: r.team.name, points: 0 };
      cur.points += r.totalPoints;
      totals.set(r.teamId, cur);
    }
  }
  return [...totals.values()].sort((a, b) => b.points - a.points)[0] ?? null;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  const [live, upcoming, recent] = await Promise.all([
    getLiveMatches(),
    getUpcomingMatches(5),
    getRecentMatches(5),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-12">
      {/* ===== Сейчас в эфире ===== */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />
          {t("liveNow")}
        </h2>
        {live.length === 0 ? (
          <p className="text-muted-foreground">{t("noLive")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((m) => (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <Card className="relative h-full transition hover:border-primary/40">
                  {m.tournament.region && (
                    <RegionTag
                      region={m.tournament.region}
                      className="absolute right-4 top-4"
                    />
                  )}
                  <CardHeader className="pr-20">
                    <CardTitle className="text-lg">{m.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {m.tournament.name}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        {/* ===== Афиша ===== */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground">{t("noUpcoming")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {upcoming.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{m.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.tournament.name}
                    </p>
                  </div>
                  {m.scheduledAt && (
                    <span className="text-sm text-muted-foreground">
                      {dateFmt.format(m.scheduledAt)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ===== Последние результаты ===== */}
        <section>
          <h2 className="mb-4 text-xl font-semibold">{t("recentResults")}</h2>
          {recent.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {recent.map((m) => {
                const winner = matchWinner(m);
                return (
                  <li key={m.id}>
                    <Link
                      href={`/matches/${m.id}`}
                      className="flex items-center justify-between px-4 py-3 transition hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{m.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.tournament.name}
                        </p>
                      </div>
                      {winner && (
                        <span className="text-right text-sm">
                          <span className="text-muted-foreground">
                            {t("winner")}:{" "}
                          </span>
                          <span className="font-medium">{winner.name}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
