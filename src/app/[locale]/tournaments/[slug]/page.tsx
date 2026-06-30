import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getTournamentBySlug } from "@/lib/queries";
import { Link } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("TournamentDetail");
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) notFound();

  const description =
    locale === "ru" ? tournament.descriptionRu : tournament.descriptionEn;

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
      {tournament.region && (
        <div className="mt-3">
          <RegionTag region={tournament.region} />
        </div>
      )}
      {description && (
        <p className="mt-2 text-muted-foreground">{description}</p>
      )}

      <Tabs defaultValue="standings" className="mt-8">
        <TabsList>
          <TabsTrigger value="standings">{t("standings")}</TabsTrigger>
          <TabsTrigger value="matches">{t("matches")}</TabsTrigger>
          <TabsTrigger value="participants">{t("participants")}</TabsTrigger>
        </TabsList>

        {/* Турнирная таблица */}
        <TabsContent value="standings" className="mt-6">
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
        </TabsContent>

        {/* Матчи */}
        <TabsContent value="matches" className="mt-6">
          {tournament.matches.length === 0 ? (
            <p className="text-muted-foreground">{t("noMatches")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {tournament.matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/matches/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 transition hover:bg-muted/50"
                  >
                    <span className="font-medium">{m.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {m._count.games} {t("games")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
