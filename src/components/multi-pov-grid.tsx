"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Минимальный тип Twitch Player SDK (грузится с player.twitch.tv).
type TwitchPlayer = { setMuted: (m: boolean) => void };
type TwitchPlayerCtor = new (
  el: string,
  opts: Record<string, unknown>,
) => TwitchPlayer;

declare global {
  interface Window {
    Twitch?: { Player: TwitchPlayerCtor };
  }
}

const SCRIPT_ID = "twitch-embed-script";
const SCRIPT_SRC = "https://player.twitch.tv/js/embed/v1.js";

export type PovStream = {
  id: string;
  channelName: string;
  title: string | null;
  type: string;
};

export function MultiPovGrid({
  streams,
  officialLabel,
  povLabel,
}: {
  streams: PovStream[];
  officialLabel: string;
  povLabel: string;
}) {
  const players = useRef<Map<string, TwitchPlayer>>(new Map());
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(
    streams[0]?.channelName ?? null,
  );

  // Грузим Twitch embed SDK один раз.
  useEffect(() => {
    if (window.Twitch?.Player) {
      setReady(true);
      return;
    }
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
    const onLoad = () => setReady(true);
    script.addEventListener("load", onLoad);
    return () => script?.removeEventListener("load", onLoad);
  }, []);

  // Создаём по плееру на канал (когда SDK готов).
  useEffect(() => {
    if (!ready || !window.Twitch?.Player) return;
    const parent = window.location.hostname;
    for (const s of streams) {
      const elId = `pov-${s.channelName}`;
      const el = document.getElementById(elId);
      if (players.current.has(s.channelName) || !el || el.childElementCount > 0)
        continue;
      const player = new window.Twitch.Player(elId, {
        channel: s.channelName,
        parent: [parent],
        muted: true,
        autoplay: true,
        width: "100%",
        height: "100%",
      });
      players.current.set(s.channelName, player);
    }
  }, [ready, streams]);

  // Звук — только у активного.
  useEffect(() => {
    players.current.forEach((player, channel) => {
      try {
        player.setMuted(channel !== active);
      } catch {
        // плеер ещё не готов — повторно применится при следующем рендере
      }
    });
  }, [active]);

  if (streams.length === 0) return null;

  const cols =
    streams.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={cn("grid gap-3", cols)}>
      {streams.map((s) => {
        const isActive = s.channelName === active;
        return (
          <div
            key={s.id}
            className={cn(
              "overflow-hidden rounded-lg border bg-card transition",
              isActive ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
              <span className="flex items-center gap-2 truncate text-xs">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                    s.type === "OFFICIAL"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.type === "OFFICIAL" ? officialLabel : povLabel}
                </span>
                <span className="truncate">{s.title ?? s.channelName}</span>
              </span>
              <button
                type="button"
                onClick={() => setActive(s.channelName)}
                aria-pressed={isActive}
                className="shrink-0 rounded px-1.5 py-0.5 text-sm transition hover:bg-muted"
                title={s.channelName}
              >
                {isActive ? "🔊" : "🔇"}
              </button>
            </div>
            <div id={`pov-${s.channelName}`} className="aspect-video w-full bg-black" />
          </div>
        );
      })}
    </div>
  );
}
