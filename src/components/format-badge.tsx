import { cn } from "@/lib/utils";

// Бейдж формата турнира/стадии. Цвет фиксирован по формату, текст (label)
// приходит уже локализованным из страницы (t(`format.${format}`)).
// Полные строки классов — Tailwind не видит интерполированные имена.
const FORMAT_STYLES: Record<string, string> = {
  SINGLE_LOBBY: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  MATCH_POINT: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  ROUND_ROBIN: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  BRACKET: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  LEAGUE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  OTHER: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const FALLBACK = "bg-slate-500/15 text-slate-300 border-slate-500/30";

export function FormatBadge({
  format,
  label,
  className,
}: {
  format: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        FORMAT_STYLES[format] ?? FALLBACK,
        className,
      )}
    >
      {label}
    </span>
  );
}
