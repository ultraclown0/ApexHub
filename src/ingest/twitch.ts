import { prisma } from "./db";

const OAUTH_URL = "https://id.twitch.tv/oauth2/token";
const HELIX_URL = "https://api.twitch.tv/helix";

// App access token (client credentials flow) — для публичных данных стримов.
async function getAppToken(clientId: string, clientSecret: string) {
  const res = await fetch(
    `${OAUTH_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Twitch OAuth: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// Обновляет Stream.isLive для всех Twitch-каналов в базе.
export async function updateTwitchLiveStatus() {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

  const streams = await prisma.stream.findMany({
    where: { platform: "twitch" },
    select: { id: true, channelName: true },
  });
  const logins = [...new Set(streams.map((s) => s.channelName.toLowerCase()))];
  if (logins.length === 0) return { channels: 0, live: 0, updated: 0 };

  const token = await getAppToken(clientId, clientSecret);
  const liveLogins = new Set<string>();

  // Helix допускает до 100 user_login за запрос.
  for (let i = 0; i < logins.length; i += 100) {
    const batch = logins.slice(i, i + 100);
    const qs = batch.map((l) => `user_login=${encodeURIComponent(l)}`).join("&");
    const res = await fetch(`${HELIX_URL}/streams?${qs}`, {
      headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Twitch /streams: ${res.status}`);
    const json = (await res.json()) as { data: { user_login: string }[] };
    for (const s of json.data ?? []) {
      liveLogins.add(String(s.user_login).toLowerCase());
    }
  }

  const now = new Date();
  let updated = 0;
  for (const s of streams) {
    await prisma.stream.update({
      where: { id: s.id },
      data: { isLive: liveLogins.has(s.channelName.toLowerCase()), lastCheckedAt: now },
    });
    updated++;
  }

  return { channels: logins.length, live: liveLogins.size, updated };
}
