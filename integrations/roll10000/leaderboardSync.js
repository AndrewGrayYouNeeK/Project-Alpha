import {
  isProjectAlphaEnabled,
  upsertLeaderboardEntity,
  listLeaderboardEntities,
  connectProjectAlphaEvents,
  LEADERBOARD_COLLECTION,
} from "@/lib/projectAlpha";

const PLAYER_ID_KEY = "roll10000_cloud_player_id";

export function getCloudPlayerId() {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `player-${Date.now()}`;
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return `player-${Date.now()}`;
  }
}

export async function syncProfileToLeaderboard(profile) {
  if (!isProjectAlphaEnabled() || !profile) return null;

  const id = getCloudPlayerId();
  const data = {
    name: profile.full_name || "Player",
    wins: profile.wins ?? 0,
    xp: profile.xp ?? 0,
    gamesFinished: profile.games_finished ?? 0,
    skinId: profile.equipped_skin ?? "classic_white",
    updatedAt: new Date().toISOString(),
  };

  const apiKey = import.meta.env.VITE_PROJECT_ALPHA_API_KEY?.trim();
  return upsertLeaderboardEntity(id, data, apiKey || undefined);
}

export async function fetchLeaderboard() {
  if (!isProjectAlphaEnabled()) return [];

  const items = await listLeaderboardEntities();
  return items
    .map((item) => ({
      id: item.id,
      ...item.data,
    }))
    .sort((a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.xp ?? 0) - (a.xp ?? 0));
}

export function subscribeLeaderboardUpdates(onUpdate) {
  if (!isProjectAlphaEnabled()) return () => {};

  const stream = connectProjectAlphaEvents((event) => {
    if (
      event.type === "entity.created" ||
      event.type === "entity.updated" ||
      event.type === "entity.deleted"
    ) {
      const payload = event.payload ?? {};
      if (payload.collection === LEADERBOARD_COLLECTION) {
        onUpdate();
      }
    }
  });

  return () => {
    stream.close();
  };
}
