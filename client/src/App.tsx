import { useEffect, useMemo, useState } from 'react';

type HealthResponse = {
  status: string;
  redis: 'connected' | 'disconnected';
  clients: number;
};

type RealtimeEvent = {
  type: string;
  payload: unknown;
  timestamp: string;
};

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function App() {
  const [apiStatus, setApiStatus] = useState<'online' | 'offline'>('offline');
  const [redisStatus, setRedisStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiBase}/health`);
        if (!response.ok) {
          throw new Error('Health check failed');
        }

        const data = (await response.json()) as HealthResponse;
        if (isMounted) {
          setApiStatus(data.status === 'healthy' ? 'online' : 'offline');
          setRedisStatus(data.redis);
        }
      } catch {
        if (isMounted) {
          setApiStatus('offline');
          setRedisStatus('disconnected');
        }
      }
    };

    void checkHealth();
    const interval = window.setInterval(() => {
      void checkHealth();
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const eventsUrl = `${apiBase}/events`;
    const stream = new EventSource(eventsUrl);

    stream.onopen = () => setRealtimeConnected(true);
    stream.onerror = () => setRealtimeConnected(false);
    stream.onmessage = (event) => {
      try {
        setLastEvent(JSON.parse(event.data) as RealtimeEvent);
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      stream.close();
      setRealtimeConnected(false);
    };
  }, []);

  const statusColor = useMemo(() => {
    return apiStatus === 'online' && redisStatus === 'connected' && realtimeConnected ? '#16a34a' : '#dc2626';
  }, [apiStatus, realtimeConnected, redisStatus]);

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', margin: '2rem auto', maxWidth: 720, lineHeight: 1.5 }}>
      <h1>Project Alpha</h1>
      <p>Real-time full-stack foundation (React + Express + Redis).</p>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Connection Status</h2>
        <ul>
          <li>
            API: <strong>{apiStatus}</strong>
          </li>
          <li>
            Redis: <strong>{redisStatus}</strong>
          </li>
          <li>
            Real-time channel: <strong>{realtimeConnected ? 'connected' : 'disconnected'}</strong>
          </li>
        </ul>
        <p>
          Overall:{' '}
          <strong style={{ color: statusColor }}>
            {apiStatus === 'online' && redisStatus === 'connected' && realtimeConnected ? 'healthy' : 'degraded'}
          </strong>
        </p>
      </section>

      <section style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Latest Event</h2>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {lastEvent ? JSON.stringify(lastEvent, null, 2) : 'Waiting for events...'}
        </pre>
      </section>
    </main>
  );
}

export default App;
