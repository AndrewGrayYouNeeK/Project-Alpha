import type { EntityRecord, RealtimeEvent } from '../../../shared/src';

const apiBase = import.meta.env.VITE_API_URL ?? '';

type HealthResponse = {
  status: string;
  redis: 'connected' | 'disconnected';
  clients: number;
  auth: 'api-key' | 'open';
};

type EntityListResponse = {
  items: EntityRecord[];
};

const buildUrl = (path: string): string => `${apiBase}${path}`;

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const projectAlpha = {
  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(buildUrl('/health'));
    return parseJson<HealthResponse>(response);
  },

  async publishEvent(type: string, payload: unknown): Promise<void> {
    const response = await fetch(buildUrl('/publish'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    await parseJson(response);
  },

  async listEntities(collection: string): Promise<EntityRecord[]> {
    const response = await fetch(buildUrl(`/entities/${encodeURIComponent(collection)}`));
    const data = await parseJson<EntityListResponse>(response);
    return data.items;
  },

  async createEntity(
    collection: string,
    data: Record<string, unknown>,
    apiKey?: string,
  ): Promise<EntityRecord> {
    const response = await fetch(buildUrl(`/entities/${encodeURIComponent(collection)}`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ data }),
    });
    return parseJson<EntityRecord>(response);
  },

  async deleteEntity(collection: string, id: string, apiKey?: string): Promise<void> {
    const response = await fetch(
      buildUrl(`/entities/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers: apiKey ? { 'X-API-Key': apiKey } : undefined,
      },
    );
    await parseJson(response);
  },

  connectEvents(onEvent: (event: RealtimeEvent) => void): EventSource {
    const stream = new EventSource(buildUrl('/events'));
    stream.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data) as RealtimeEvent);
      } catch {
        // ignore malformed events
      }
    };
    return stream;
  },
};

export type { EntityRecord, HealthResponse, RealtimeEvent };
