"use client";

import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="w-full px-6 py-8 text-sm text-muted-foreground">
        <p className="font-bold text-foreground">
          Apex<span className="text-primary">Hub</span>
        </p>
        <p className="mt-1 max-w-xl">{t("tagline")}</p>
        <p className="mt-3 text-xs">{t("attribution")}</p>
      </div>
    </footer>
  );
}
