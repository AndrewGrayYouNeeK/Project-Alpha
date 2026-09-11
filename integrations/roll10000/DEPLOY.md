# Deploy Project Alpha for roll10000.com

## What you get live

- Global wins leaderboard on https://www.roll10000.com/leaderboard
- Wins sync from any device after a match win
- Real-time updates when other players win (SSE)

## 1. Deploy Project Alpha API

Pick a host with Docker (Railway, Fly.io, Hetzner, DigitalOcean, etc.).

```bash
git clone https://github.com/AndrewGrayYouNeeK/Project-Alpha.git
cd Project-Alpha
cp .env.example .env
```

Edit `.env`:

```env
CLIENT_ORIGIN=https://www.roll10000.com,https://roll10000.pages.dev
# Optional but recommended for write protection:
# API_KEY=generate-a-long-random-string
```

```bash
docker compose up -d --build
```

Note your public URL, e.g. `https://api.roll10000.com` → port 3001.

Verify:

```bash
curl https://api.roll10000.com/health
```

## 2. Apply integration to 10000TheFinalBoss

```bash
cd 10000TheFinalBoss
git apply /path/to/Project-Alpha/integrations/roll10000/10000TheFinalBoss.patch
# Or copy the three files from integrations/roll10000/
```

## 3. Cloudflare Pages env (roll10000)

In the `roll10000` Pages project → Settings → Environment variables:

| Variable | Value |
|----------|-------|
| `VITE_PROJECT_ALPHA_URL` | `https://api.roll10000.com` |
| `VITE_PROJECT_ALPHA_API_KEY` | same as Project Alpha `API_KEY` (if set) |

Redeploy:

```bash
npm run deploy:web
```

## 4. Smoke test

1. Win a local or online match on roll10000.com
2. Open `/leaderboard`
3. Your name + win count should appear
4. Open leaderboard in two tabs — second tab should update when a win syncs

## Costs (rough)

- **Cloudflare Pages** — free tier (already using)
- **VPS + Redis** — ~$5–12/mo (Hetzner, DO, etc.)
- **No Base44 fees**

## When to skip deployment

If you only want offline single-player, localStorage is enough. Deploy Project Alpha when you want **shared** leaderboard data across players/devices.
