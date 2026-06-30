import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Двуязычие RU + EN заложено с самого старта (см. BRIEF.md §7)
  locales: ["en", "ru"],
  defaultLocale: "en",
});
