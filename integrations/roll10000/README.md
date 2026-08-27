# roll10000 ↔ Project Alpha integration

Connects **YouNeeK 10,000** (`AndrewGrayYouNeeK/10000TheFinalBoss`) to Project Alpha for a **live global wins leaderboard**.

## What it does

- On each **win**, player stats sync to Project Alpha collection `roll10000-leaderboard`
- **Leaderboard** page (`/leaderboard`) shows top players by wins (live updates via SSE)
- Local profile / cosmetics still use `localStorage` — Project Alpha only syncs shared leaderboard data

## Apply to 10000TheFinalBoss

Copy files from this folder into the game repo:

| This repo | Game repo |
|-----------|-----------|
| `projectAlpha.js` | `src/lib/projectAlpha.js` |
| `leaderboardSync.js` | `src/lib/leaderboardSync.js` |
| `Leaderboard.jsx` | `src/pages/Leaderboard.jsx` |

Also apply the edits in `10000TheFinalBoss.patch` (or merge branch `cursor/project-alpha-leaderboard-0f4c` locally).

## Local dev (both repos)

```bash
# Terminal 1 — Project Alpha
cd Project-Alpha
docker compose up

# Terminal 2 — roll10000
cd 10000TheFinalBoss
npm run dev
```

1. Play and **win** a local match
2. Home → **Leaderboard**
3. Your wins should appear (and update live if another client wins)

Vite proxies `/project-alpha` → `http://127.0.0.1:3001` in dev — no env vars required locally.

## Production

**Project Alpha** — deploy API, set `CLIENT_ORIGIN`:

```env
CLIENT_ORIGIN=https://www.roll10000.com,https://roll10000.pages.dev
```

**roll10000** — Cloudflare Pages env:

```env
VITE_PROJECT_ALPHA_URL=https://your-api-host:3001
```

If Project Alpha uses `API_KEY`, also set `VITE_PROJECT_ALPHA_API_KEY` on the Pages build.

## Entity shape

```json
{
  "id": "player-uuid-from-localStorage",
  "data": {
    "name": "Player",
    "wins": 12,
    "xp": 4500,
    "gamesFinished": 20,
    "skinId": "ragnarok",
    "updatedAt": "2026-08-27T10:00:00.000Z"
  }
}
```
