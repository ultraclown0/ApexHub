"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export function StatsControls({
  tournaments,
}: {
  tournaments: { id: string; name: string }[];
}) {
  const t = useTranslations("Stats");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("tournament") ?? "";

  function update(value: string) {
    const query: Record<string, string> = {};
    for (const [k, v] of sp.entries()) query[k] = v;
    if (value) query.tournament = value;
    else delete query.tournament;
    router.replace({ pathname, query });
  }

  return (
    <NativeSelect
      value={current}
      onChange={(e) => update(e.target.value)}
      aria-label={t("allTournaments")}
    >
      <option value="">{t("allTournaments")}</option>
      {tournaments.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </NativeSelect>
  );
}
