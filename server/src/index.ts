import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { isRealtimeEvent, type RealtimeEvent } from '../../shared/src';

const app = express();

const PORT = Number(process.env.PORT ?? 3001);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const REDIS_CHANNEL = process.env.REDIS_CHANNEL ?? 'project-alpha:events';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 15000);
const PUBLISH_RATE_LIMIT_WINDOW_MS = Number(process.env.PUBLISH_RATE_LIMIT_WINDOW_MS ?? 60000);
const PUBLISH_RATE_LIMIT_MAX_REQUESTS = Number(process.env.PUBLISH_RATE_LIMIT_MAX_REQUESTS ?? 60);

app.use(cors({ origin: CLIENT_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json());

const publisher = createClient({ url: REDIS_URL });
const subscriber = publisher.duplicate();

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

app.get('/', (_req, res) => {
  res.json({ message: 'Project Alpha server is running' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    redis: publisher.isReady && subscriber.isReady ? 'connected' : 'disconnected',
    clients: clients.size,
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

app.post('/publish', publishRateLimiter, async (req, res) => {
  const candidate = {
    type: String(req.body?.type ?? 'message'),
    payload: req.body?.payload ?? null,
    timestamp: new Date().toISOString(),
  };

  if (!isRealtimeEvent(candidate)) {
    return res.status(400).json({ error: 'Invalid event payload' });
  }

  if (!publisher.isReady) {
    return res.status(503).json({ error: 'Redis is not connected' });
  }

  await publisher.publish(REDIS_CHANNEL, JSON.stringify(candidate));
  return res.status(202).json({ status: 'published' });
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
