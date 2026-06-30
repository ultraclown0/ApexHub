"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/tournaments", key: "tournaments" },
  { href: "/stats", key: "stats" },
] as const;

export function SiteHeader() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="flex h-14 w-full items-center gap-6 px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Apex<span className="text-primary">Hub</span>
        </Link>

        <nav className="flex h-14 items-stretch gap-1 text-sm">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center px-3 transition hover:text-foreground",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {t(item.key)}
                {active && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
