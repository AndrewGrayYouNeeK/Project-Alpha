import React, { useCallback, useEffect, useState } from "react";
import { Trophy, Wifi, WifiOff } from "lucide-react";
import BackButton, { PAGE_HEADER_SAFE_STYLE } from "@/components/ui/BackButton";
import {
  fetchLeaderboard,
  subscribeLeaderboardUpdates,
} from "@/lib/leaderboardSync";
import { isProjectAlphaEnabled } from "@/lib/projectAlpha";
import { getSkin } from "@/lib/shopCatalog";

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const enabled = isProjectAlphaEnabled();

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await fetchLeaderboard();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubscribe = subscribeLeaderboardUpdates(() => {
      void refresh();
    });

    const probe = new EventSource(
      import.meta.env.VITE_PROJECT_ALPHA_URL?.trim()
        ? `${import.meta.env.VITE_PROJECT_ALPHA_URL.replace(/\/$/, "")}/events`
        : "/project-alpha/events",
    );
    probe.onopen = () => setLive(true);
    probe.onerror = () => setLive(false);

    return () => {
      unsubscribe();
      probe.close();
      setLive(false);
    };
  }, [enabled, refresh]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div
        className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 pb-3 flex items-center gap-3"
        style={PAGE_HEADER_SAFE_STYLE}
      >
        <BackButton to="/" label="Back" />
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          Global Wins
        </h1>
        {enabled && (
          <span className="ml-auto text-[10px] font-bold flex items-center gap-1 text-slate-400">
            {live ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3" />}
            {live ? "Live" : "Offline"}
          </span>
        )}
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4 pb-10">
        {!enabled && (
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-sm text-slate-300">
            <p>
              Project Alpha is not configured. Set <code className="text-cyan-300">VITE_PROJECT_ALPHA_URL</code>{" "}
              to your API (or run <code className="text-cyan-300">npm run dev</code> with Project Alpha on port 3001).
            </p>
          </section>
        )}

        {enabled && loading && (
          <p className="text-sm text-slate-400 text-center py-8">Loading leaderboard…</p>
        )}

        {error && (
          <section className="bg-rose-950/40 rounded-2xl p-4 border border-rose-800 text-sm text-rose-200">
            {error}
          </section>
        )}

        {enabled && !loading && !error && rows.length === 0 && (
          <section className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-sm text-slate-300">
            No wins synced yet. Win a local or online match and your stats will appear here.
          </section>
        )}

        {rows.map((row, index) => {
          const skin = getSkin(row.skinId);
          return (
            <section
              key={row.id}
              className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex items-center gap-3"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                style={{
                  background:
                    index === 0
                      ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                      : index === 1
                        ? "linear-gradient(135deg, #94a3b8, #64748b)"
                        : index === 2
                          ? "linear-gradient(135deg, #cd7f32, #a16207)"
                          : "rgba(0,255,200,0.12)",
                  color: index < 3 ? "#000" : "#00ffc8",
                }}
              >
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{row.name || "Player"}</p>
                <p className="text-xs text-slate-400 truncate">
                  {row.wins ?? 0} wins · {(row.xp ?? 0).toLocaleString()} XP
                  {skin?.name ? ` · ${skin.name}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-amber-400">{row.wins ?? 0}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">wins</p>
              </div>
            </section>
          );
        })}

        <p className="text-[11px] text-slate-500 text-center">
          Powered by Project Alpha — self-hosted sync (not Base44).
        </p>
      </div>
    </div>
  );
}
