import "dotenv/config";
import { prisma } from "./db";
import { recordSync } from "./sync-state";
import { updateTwitchLiveStatus } from "./twitch";
import { ingestDgs } from "./dgs";
import { ingestLiquipedia } from "./liquipedia";

type Source = {
  run: () => Promise<unknown>;
  env: string[]; // обязательные переменные окружения
};

const SOURCES: Record<string, Source> = {
  // Twitch — частый запуск (статус «в эфире»).
  twitch: { run: updateTwitchLiveStatus, env: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET"] },
  // DGS — основная турнирная статистика.
  dgs: { run: ingestDgs, env: ["DGS_API_TOKEN"] },
  // Liquipedia — каталог и ссылки на стримы.
  liquipedia: { run: ingestLiquipedia, env: ["LIQUIPEDIA_API_KEY"] },
};

async function main() {
  const args = process.argv.slice(2);
  const selected = args.length > 0 ? args : Object.keys(SOURCES);

  console.log(`Ингест: запускаю источники → ${selected.join(", ")}\n`);

  for (const name of selected) {
    const source = SOURCES[name];
    if (!source) {
      console.log(`⚠️  неизвестный источник: ${name}`);
      continue;
    }

    const missing = source.env.filter((e) => !process.env[e]);
    if (missing.length > 0) {
      console.log(`⏭️  ${name}: пропущен (в .env нет: ${missing.join(", ")})`);
      continue;
    }

    try {
      console.log(`▶  ${name}…`);
      const result = await source.run();
      console.log(`✅ ${name}:`, result, "\n");
      await recordSync(name, "run", "ok", JSON.stringify(result));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`❌ ${name}: ${message}\n`);
      await recordSync(name, "run", "error", message);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
