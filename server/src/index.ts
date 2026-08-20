import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { isRealtimeEvent, type RealtimeEvent } from '../../shared/src';
import { EntityStore } from './entities';

const app = express();

const PORT = Number(process.env.PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REDIS_CHANNEL = process.env.REDIS_CHANNEL ?? 'project-alpha:events';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 15000);
const PUBLISH_RATE_LIMIT_WINDOW_MS = Number(process.env.PUBLISH_RATE_LIMIT_WINDOW_MS ?? 60000);
const PUBLISH_RATE_LIMIT_MAX_REQUESTS = Number(process.env.PUBLISH_RATE_LIMIT_MAX_REQUESTS ?? 60);
const API_KEY = process.env.API_KEY?.trim() ?? '';

app.use(cors({ origin: CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json());

const publisher = createClient({ url: REDIS_URL });
const subscriber = publisher.duplicate();
const entityStore = new EntityStore(publisher);

type SseResponse = express.Response;
const clients = new Set<SseResponse>();

const broadcast = (event: RealtimeEvent): void => {
  const serialized = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    client.write(serialized);
  }
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const publishRateLimiter = rateLimit({
  windowMs: PUBLISH_RATE_LIMIT_WINDOW_MS,
  limit: PUBLISH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many publish requests' },
});

const mutationRateLimiter = rateLimit({
  windowMs: PUBLISH_RATE_LIMIT_WINDOW_MS,
  limit: PUBLISH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many mutation requests' },
});

const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (!API_KEY) {
    next();
    return;
  }

  const provided = req.header('x-api-key');
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }

  next();
};

const requireRedis = (_req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (!publisher.isReady) {
    res.status(503).json({ error: 'Redis is not connected' });
    return;
  }

  next();
};

const publishEntityEvent = async (type: string, payload: Record<string, unknown>): Promise<void> => {
  const event: RealtimeEvent = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };

  await publisher.publish(REDIS_CHANNEL, JSON.stringify(event));
};

app.get('/', (_req, res) => {
  res.json({
    message: 'Project Alpha server is running',
    stack: 'self-hosted (no Base44)',
    features: ['realtime', 'entities'],
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    redis: publisher.isReady && subscriber.isReady ? 'connected' : 'disconnected',
    clients: clients.size,
    auth: API_KEY ? 'api-key' : 'open',
  });
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.add(res);

  res.write(
    `data: ${JSON.stringify({ type: 'connected', payload: { ok: true }, timestamp: new Date().toISOString() })}\n\n`,
  );

  req.on('close', () => {
    clients.delete(res);
    res.end();
  });
});

app.post('/publish', publishRateLimiter, requireRedis, async (req, res) => {
  const candidate = {
    type: String(req.body?.type ?? 'message'),
    payload: req.body?.payload ?? null,
    timestamp: new Date().toISOString(),
  };

  if (!isRealtimeEvent(candidate)) {
    return res.status(400).json({ error: 'Invalid event payload' });
  }

  await publisher.publish(REDIS_CHANNEL, JSON.stringify(candidate));
  return res.status(202).json({ status: 'published' });
});

app.get('/entities/:collection', requireRedis, async (req, res) => {
  try {
    const records = await entityStore.list(req.params.collection);
    return res.json({ items: records });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
  }
});

app.get('/entities/:collection/:id', requireRedis, async (req, res) => {
  try {
    const record = await entityStore.get(req.params.collection, req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    return res.json(record);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
  }
});

app.post('/entities/:collection', mutationRateLimiter, requireApiKey, requireRedis, async (req, res) => {
  const data = req.body?.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must include a data object' });
  }

  try {
    const id = typeof req.body?.id === 'string' ? req.body.id : undefined;
    const record = await entityStore.create(req.params.collection, data as Record<string, unknown>, id);
    await publishEntityEvent('entity.created', {
      collection: req.params.collection,
      id: record.id,
    });
    return res.status(201).json(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    const status = message === 'Entity already exists' ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});

app.put('/entities/:collection/:id', mutationRateLimiter, requireApiKey, requireRedis, async (req, res) => {
  const data = req.body?.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ error: 'Body must include a data object' });
  }

  try {
    const record = await entityStore.update(
      req.params.collection,
      req.params.id,
      data as Record<string, unknown>,
    );
    if (!record) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    await publishEntityEvent('entity.updated', {
      collection: req.params.collection,
      id: record.id,
    });
    return res.json(record);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
  }
});

app.delete('/entities/:collection/:id', mutationRateLimiter, requireApiKey, requireRedis, async (req, res) => {
  try {
    const deleted = await entityStore.delete(req.params.collection, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    await publishEntityEvent('entity.deleted', {
      collection: req.params.collection,
      id: req.params.id,
    });
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid request' });
  }
});

const start = async (): Promise<void> => {
  let subscribed = false;

  publisher.on('error', (error) => {
    console.error('Redis publisher error:', error);
  });

  subscriber.on('error', (error) => {
    console.error('Redis subscriber error:', error);
  });

  const ensureRedisConnection = async (): Promise<void> => {
    while (!(publisher.isReady && subscriber.isReady)) {
      try {
        if (!publisher.isOpen) {
          await publisher.connect();
        }
        if (!subscriber.isOpen) {
          await subscriber.connect();
        }

        if (!subscribed) {
          await subscriber.subscribe(REDIS_CHANNEL, (message) => {
            try {
              const parsed = JSON.parse(message) as unknown;
              if (isRealtimeEvent(parsed)) {
                broadcast(parsed);
              }
            } catch {
              // Ignore malformed events.
            }
          });
          subscribed = true;
          console.log(`Subscribed to Redis channel "${REDIS_CHANNEL}"`);
        }
      } catch (error) {
        console.error('Redis connection attempt failed, retrying...', error);
        await sleep(2000);
      }
    }
  };

  app.listen(PORT, () => {
    console.log(`🚀 Project Alpha server running on port ${PORT}`);
  });

  void ensureRedisConnection();

  setInterval(async () => {
    if (!publisher.isReady) {
      return;
    }

    const heartbeat: RealtimeEvent = {
      type: 'heartbeat',
      payload: { redis: 'ok' },
      timestamp: new Date().toISOString(),
    };

    try {
      await publisher.publish(REDIS_CHANNEL, JSON.stringify(heartbeat));
    } catch (error) {
      console.error('Failed to publish heartbeat:', error);
    }
  }, HEARTBEAT_INTERVAL_MS).unref();
};

void start().catch((error) => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
