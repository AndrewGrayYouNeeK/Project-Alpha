# Project Alpha

Real-time full-stack autonomous system foundation built with React, Node.js, Redis, and Docker.

## Structure

```text
project-alpha/
├── client/                     # React + Vite + TypeScript
├── server/                     # Node.js + Express + TypeScript
├── shared/                     # Shared types and schemas
├── docker-compose.yml
├── .env.example
└── .github/workflows/deploy.yml
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Client: http://localhost:5173
- Server: http://localhost:3001
- Redis:  localhost:6379

## Server endpoints

- `GET /` server status
- `GET /health` health + Redis connectivity
- `GET /events` Server-Sent Events stream (Redis Pub/Sub)
- `POST /publish` publish event `{ "type": "message", "payload": { ... } }`
