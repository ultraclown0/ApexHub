import { RateLimiter } from "./throttle";

// Liquipedia LPDB API v3. База настраивается через env.
const LP_BASE =
  process.env.LIQUIPEDIA_API_BASE ?? "https://api.liquipedia.net/api/v3";

// Лимит: 60 запросов в час → не чаще 1 в минуту.
const limiter = new RateLimiter(60_000);

async function lpGet(datapoint: string, params: Record<string, string>) {
  await limiter.wait();
  const key = process.env.LIQUIPEDIA_API_KEY!;
  const qs = new URLSearchParams({ wiki: "apexlegends", ...params }).toString();
  const res = await fetch(`${LP_BASE}/${datapoint}?${qs}`, {
    headers: {
      // Liquipedia требует ключ в заголовке Authorization: Apikey ...
      Authorization: `Apikey ${key}`,
      // Атрибуция CC-BY-SA отображается в подвале сайта (SiteFooter).
      "User-Agent": "ApexHub/0.1 (non-commercial; tournament aggregator)",
    },
  });
  if (!res.ok) throw new Error(`Liquipedia ${datapoint}: ${res.status}`);
  return res.json();
}

export async function ingestLiquipedia() {
  // РЕЖИМ РАЗВЕДКИ: получаем последние турниры и печатаем форму ответа,
  // чтобы довести точный маппинг (турниры/команды/игроки/стримы).
  const raw = (await lpGet("tournament", {
    limit: "10",
    order: "startdate DESC",
  })) as Record<string, unknown>;

  const result = Array.isArray((raw as { result?: unknown[] }).result)
    ? (raw as { result: Record<string, unknown>[] }).result
    : [];

  console.log(`Liquipedia: получено записей: ${result.length}.`);
  if (result.length > 0) {
    console.log(
      "Liquipedia: поля первой записи:",
      Object.keys(result[0]).join(", "),
    );
  } else {
    console.log("Liquipedia: форма ответа:", JSON.stringify(raw).slice(0, 600));
  }

  // Маппинг в наши таблицы (Tournament/Team/Player/Stream) добавим, сверив
  // точные имена полей по этому ответу.
  return { fetched: result.length, note: "discovery mode — mapping pending" };
}
