# Project Alpha

Self-hosted real-time full-stack foundation built with React, Node.js, Redis, and Docker. This stack replaces hosted BaaS platforms (including Base44) with your own API, storage, and real-time channel.

## Structure

```text
project-alpha/
├── client/                     # React + Vite + TypeScript
├── server/                     # Node.js + Express + TypeScript
├── shared/                     # Shared types and schemas
├── package.json                # Root scripts
├── docker-compose.yml
├── .env.example
└── .github/workflows/deploy.yml
```

## Quick start

```bash
cp .env.example .env
npm run install:all
docker compose up --build
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Redis:  localhost:6379

Local development without Docker:

```bash
npm run install:all
npm run dev:server   # terminal 1
npm run dev:client   # terminal 2 (proxies API to :3001)
```

## Server endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Server status |
| `GET /health` | Health + Redis connectivity |
| `GET /events` | Server-Sent Events stream (Redis Pub/Sub) |
| `POST /publish` | Publish event `{ "type": "message", "payload": { ... } }` |
| `GET /entities/:collection` | List entities in a collection |
| `GET /entities/:collection/:id` | Get one entity |
| `POST /entities/:collection` | Create entity `{ "data": { ... } }` |
| `PUT /entities/:collection/:id` | Update entity `{ "data": { ... } }` |
| `DELETE /entities/:collection/:id` | Delete entity |

`POST /publish` and entity mutations have per-IP rate limits enabled by default.

Set `API_KEY` on the server to require `X-API-Key` for entity create/update/delete. Reads stay public.

## Base44 migration notes

- Replace `@base44/sdk` and `base44.entities.*` calls with the `/entities` REST API or `client/src/api/projectAlpha.ts`.
- Replace `@base44/vite-plugin` with the standard Vite `@` alias in `vite.config` (already used here via proxy + native client).
- Replace Base44 real-time/functions with `POST /publish` + SSE `/events`.

## Client API module

Use the native client instead of any hosted SDK:

```ts
import { projectAlpha } from './api/projectAlpha';

const health = await projectAlpha.getHealth();
const notes = await projectAlpha.listEntities('notes');
await projectAlpha.createEntity('notes', { text: 'Hello' });
```

## Connected apps

### YouNeeK 10,000 (`10000TheFinalBoss` / roll10000.com)

Global wins leaderboard syncs to collection `roll10000-leaderboard` when players win matches.

**Local dev (both repos):**

```bash
# Terminal 1 — Project Alpha (Redis + API on :3001)
cd Project-Alpha && docker compose up

# Terminal 2 — roll10000 (Vite proxies /project-alpha → :3001)
cd 10000TheFinalBoss && npm run dev
```

Win a game, then open **Leaderboard** on the home screen.

**Production:** set on roll10000 build:

```env
VITE_PROJECT_ALPHA_URL=https://your-api-host:3001
```

Ensure Project Alpha `CLIENT_ORIGIN` includes your Pages domain (e.g. `https://www.roll10000.com`).
