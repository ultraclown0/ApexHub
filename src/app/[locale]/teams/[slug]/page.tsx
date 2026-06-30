import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTeamBySlug } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { StatTile } from "@/components/stat-tile";
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

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Team");
  const data = await getTeamBySlug(slug);
  if (!data) notFound();

  const { team, stats, recentMatches } = data;
  const avgPlace =
    stats.avgPlacement != null ? stats.avgPlacement.toFixed(1) : "—";

  return (
    <>
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
        {team.tag && (
          <span className="text-lg text-muted-foreground">{team.tag}</span>
        )}
      </div>
      {team.region && (
        <div className="mt-2">
          <RegionTag region={team.region} />
        </div>
      )}

      {/* Агрегированная статистика */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label={t("games")} value={stats.games} />
        <StatTile label={t("wins")} value={stats.wins} />
        <StatTile label={t("kills")} value={stats.kills} />
        <StatTile label={t("avgPlace")} value={avgPlace} />
        <StatTile label={t("points")} value={stats.points} />
      </div>

      {/* Состав */}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">{t("roster")}</h2>
        <div className="flex flex-wrap gap-2">
          {team.rosterSpots.map((spot) => (
            <Link
              key={spot.id}
              href={`/players/${spot.player.slug}`}
              className="rounded-md border px-3 py-2 text-sm transition hover:border-foreground/30"
            >
              {spot.player.handle}
              {spot.player.role && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {spot.player.role}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* История турниров */}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">{t("tournaments")}</h2>
        {team.participants.length === 0 ? (
          <p className="text-muted-foreground">{t("noData")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tournament")}</TableHead>
                <TableHead className="text-right">{t("place")}</TableHead>
                <TableHead className="text-right">{t("points")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.participants.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/tournaments/${p.tournament.slug}`}
                      className="hover:underline"
                    >
                      {p.tournament.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.finalPlacement ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.totalPoints ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Недавние матчи */}
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">{t("recentMatches")}</h2>
        {recentMatches.length === 0 ? (
          <p className="text-muted-foreground">{t("noData")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {recentMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 transition hover:bg-muted/50"
                >
                  <span className="font-medium">{m.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.tournament.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
