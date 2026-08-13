import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectAlpha, type EntityRecord, type RealtimeEvent } from './api/projectAlpha';

const DEFAULT_COLLECTION = 'notes';
const API_KEY_STORAGE = 'projectAlphaApiKey';

function App() {
  const [apiStatus, setApiStatus] = useState<'online' | 'offline'>('offline');
  const [redisStatus, setRedisStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [authMode, setAuthMode] = useState<'api-key' | 'open'>('open');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [eventType, setEventType] = useState('message');
  const [eventPayload, setEventPayload] = useState('{"text":"Hello from Project Alpha"}');
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [collection, setCollection] = useState(DEFAULT_COLLECTION);
  const [entityText, setEntityText] = useState('A self-hosted note');
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [entityStatus, setEntityStatus] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '');

  const refreshEntities = useCallback(async () => {
    try {
      const items = await projectAlpha.listEntities(collection);
      setEntities(items);
      setEntityStatus(null);
    } catch (error) {
      setEntityStatus(error instanceof Error ? error.message : 'Failed to load entities');
    }
  }, [collection]);

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const data = await projectAlpha.getHealth();
        if (!isMounted) {
          return;
        }

        setApiStatus(data.status === 'healthy' ? 'online' : 'offline');
        setRedisStatus(data.redis);
        setAuthMode(data.auth);
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
    const stream = projectAlpha.connectEvents((event) => {
      setLastEvent(event);
      if (event.type.startsWith('entity.')) {
        void refreshEntities();
      }
    });

    stream.onopen = () => setRealtimeConnected(true);
    stream.onerror = () => setRealtimeConnected(false);

    return () => {
      stream.close();
      setRealtimeConnected(false);
    };
  }, [refreshEntities]);

  useEffect(() => {
    void refreshEntities();
  }, [refreshEntities]);

  const statusColor = useMemo(() => {
    return apiStatus === 'online' && redisStatus === 'connected' && realtimeConnected ? '#16a34a' : '#dc2626';
  }, [apiStatus, realtimeConnected, redisStatus]);

  const handlePublish = async (): Promise<void> => {
    setPublishStatus(null);
    try {
      const payload = JSON.parse(eventPayload) as unknown;
      await projectAlpha.publishEvent(eventType, payload);
      setPublishStatus('Event published');
    } catch (error) {
      setPublishStatus(error instanceof Error ? error.message : 'Publish failed');
    }
  };

  const handleCreateEntity = async (): Promise<void> => {
    setEntityStatus(null);
    try {
      await projectAlpha.createEntity(collection, { text: entityText }, apiKey || undefined);
      setEntityText('');
      await refreshEntities();
      setEntityStatus('Entity created');
    } catch (error) {
      setEntityStatus(error instanceof Error ? error.message : 'Create failed');
    }
  };

  const handleDeleteEntity = async (id: string): Promise<void> => {
    setEntityStatus(null);
    try {
      await projectAlpha.deleteEntity(collection, id, apiKey || undefined);
      await refreshEntities();
      setEntityStatus('Entity deleted');
    } catch (error) {
      setEntityStatus(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const saveApiKey = (): void => {
    localStorage.setItem(API_KEY_STORAGE, apiKey);
    setEntityStatus('API key saved locally');
  };

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', margin: '2rem auto', maxWidth: 820, lineHeight: 1.5 }}>
      <h1>Project Alpha</h1>
      <p>Self-hosted real-time stack — Redis Pub/Sub, SSE, and entity storage. No Base44 dependency.</p>

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
          <li>
            Mutations: <strong>{authMode === 'api-key' ? 'API key required' : 'open'}</strong>
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
        <h2 style={{ marginTop: 0 }}>Publish Event</h2>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Type
          <input
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Payload (JSON)
          <textarea
            value={eventPayload}
            onChange={(event) => setEventPayload(event.target.value)}
            rows={4}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <button type="button" onClick={() => void handlePublish()}>Publish</button>
        {publishStatus ? <p>{publishStatus}</p> : null}
      </section>

      <section style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Entity Storage</h2>
        <p style={{ marginTop: 0 }}>Replaces hosted BaaS entity APIs with Redis-backed collections.</p>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          API key (optional, for mutations when server sets API_KEY)
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <button type="button" onClick={saveApiKey} style={{ marginBottom: '0.75rem' }}>Save API key</button>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Collection
          <input
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          New entity text
          <input
            value={entityText}
            onChange={(event) => setEntityText(event.target.value)}
            style={{ width: '100%', marginTop: '0.25rem' }}
          />
        </label>
        <button type="button" onClick={() => void handleCreateEntity()}>Create entity</button>
        {entityStatus ? <p>{entityStatus}</p> : null}
        <ul style={{ marginTop: '1rem' }}>
          {entities.length === 0 ? <li>No entities yet.</li> : null}
          {entities.map((entity) => (
            <li key={entity.id} style={{ marginBottom: '0.5rem' }}>
              <code>{entity.id}</code> — {String((entity.data as Record<string, unknown>).text ?? JSON.stringify(entity.data))}
              <button type="button" onClick={() => void handleDeleteEntity(entity.id)} style={{ marginLeft: '0.5rem' }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
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
