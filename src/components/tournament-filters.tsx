"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { NativeSelect } from "@/components/ui/native-select";

type Props = {
  regions: string[];
  seasons: string[];
};

export function TournamentFilters({ regions, seasons }: Props) {
  const t = useTranslations("Tournaments.filters");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = (key: string) => sp.get(key) ?? "";
  const hasAny = ["region", "season"].some((k) => current(k));

  function update(key: string, value: string) {
    const query: Record<string, string> = {};
    for (const [k, v] of sp.entries()) query[k] = v;
    if (value) query[key] = value;
    else delete query[key];
    router.replace({ pathname, query });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        value={current("region")}
        onChange={(e) => update("region", e.target.value)}
        aria-label={t("region")}
      >
        <option value="">{t("allRegions")}</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </NativeSelect>

      <NativeSelect
        value={current("season")}
        onChange={(e) => update("season", e.target.value)}
        aria-label={t("season")}
      >
        <option value="">{t("allSeasons")}</option>
        {seasons.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </NativeSelect>

      {hasAny && (
        <button
          type="button"
          onClick={() => router.replace({ pathname })}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
