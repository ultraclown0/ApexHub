import { cn } from "@/lib/utils";

// Фиксированная палитра по регионам. Полупрозрачный фон + цветной текст/рамка —
// читаемо на тёмной теме. Ключи нормализуются (регистр/пробелы).
// Полные строки классов — Tailwind не видит интерполированные имена.
const REGION_STYLES: Record<string, string> = {
  EMEA: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  NA: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  AMERICAS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  APAC: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "APAC NORTH": "bg-violet-500/15 text-violet-300 border-violet-500/30",
  "APAC SOUTH": "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  SA: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  GLOBAL: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const FALLBACK = "bg-slate-500/15 text-slate-300 border-slate-500/30";

function styleFor(region: string): string {
  return REGION_STYLES[region.trim().toUpperCase()] ?? FALLBACK;
}

export function RegionTag({
  region,
  className,
}: {
  region: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styleFor(region),
        className,
      )}
    >
      {region}
    </span>
  );
}
