import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// next-intl сам определяет локаль по URL/заголовкам и проставляет префикс.
const intlMiddleware = createMiddleware(routing);

// Проверка Basic Auth для админки. Пароль — из env ADMIN_PASSWORD.
function isAdminAuthorized(req: NextRequest): boolean {
  const expectedUser = process.env.ADMIN_USER || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) return false; // пароль не задан → доступа нет

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  try {
    const [user, pass] = atob(header.slice(6)).split(":");
    return user === expectedUser && pass === expectedPass;
  } catch {
    return false;
  }
}

// Next.js 16: конвенция `proxy` (бывш. `middleware`).
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Админка: вне i18n, под Basic Auth.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAdminAuthorized(req)) {
      return new NextResponse("Authentication required.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="ApexHub Admin"' },
      });
    }
    return NextResponse.next();
  }

  // Остальной сайт — локализуем.
  return intlMiddleware(req);
}

export const config = {
  // Пропускаем статику, API и файлы с расширением — остальное обрабатываем.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
