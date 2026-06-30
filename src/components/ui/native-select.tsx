import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Нативный <select> с кастомной стрелкой: одинаковые боковые отступы,
// компактная высота. Стрелка не перехватывает клики (pointer-events-none).
export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "appearance-none rounded-md border bg-background py-1 pl-2.5 pr-8 text-sm text-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
