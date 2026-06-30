import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPlayerBySlug } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { StatTile } from "@/components/stat-tile";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Player");
  const data = await getPlayerBySlug(slug);
  if (!data) notFound();

  const { player, stats, recentMatches } = data;
  const currentTeam = player.rosterSpots[0]?.team ?? null;
  const pov = player.streams[0] ?? null;
  const avgKills = stats.avgKills != null ? stats.avgKills.toFixed(1) : "—";
  const avgDamage =
    stats.avgDamage != null ? Math.round(stats.avgDamage).toString() : "—";

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{player.handle}</h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          {t("team")}:{" "}
          {currentTeam ? (
            <Link
              href={`/teams/${currentTeam.slug}`}
              className="text-foreground hover:underline"
            >
              {currentTeam.name}
            </Link>
          ) : (
            t("freeAgent")
          )}
        </span>
        {player.role && (
          <span>
            {t("role")}: <span className="text-foreground">{player.role}</span>
          </span>
        )}
        {player.country && (
          <span>
            {t("country")}:{" "}
            <span className="text-foreground">{player.country}</span>
          </span>
        )}
      </div>

      {pov && (
        <a
          href={`https://twitch.tv/${pov.channelName}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-md border px-3 py-2 text-sm transition hover:border-foreground/30"
        >
          {t("watchTwitch")} → {pov.channelName}
        </a>
      )}

      {/* Агрегированная статистика */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label={t("games")} value={stats.games} />
        <StatTile label={t("kills")} value={stats.kills} />
        <StatTile label={t("assists")} value={stats.assists} />
        <StatTile label={t("avgKills")} value={avgKills} />
        <StatTile label={t("avgDamage")} value={avgDamage} />
      </div>

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
