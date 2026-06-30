import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Локализованные обёртки навигации (Link, redirect, useRouter и т.д.),
// автоматически проставляющие префикс локали.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
