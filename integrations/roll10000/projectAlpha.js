/**
 * Lightweight Project Alpha client for roll10000.
 * Replaces hosted BaaS entity APIs with the self-hosted Project Alpha stack.
 */

const COLLECTION = "roll10000-leaderboard";

function getApiBase() {
  const configured = import.meta.env.VITE_PROJECT_ALPHA_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (import.meta.env.DEV) {
    return "/project-alpha";
  }
  return "";
}

export function isProjectAlphaEnabled() {
  return !!getApiBase();
}

function buildUrl(path) {
  return `${getApiBase()}${path}`;
}

async function parseJson(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

export async function listLeaderboardEntities() {
  const response = await fetch(buildUrl(`/entities/${COLLECTION}`));
  const data = await parseJson(response);
  return data?.items ?? [];
}

export async function upsertLeaderboardEntity(id, data, apiKey) {
  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };

  const updateResponse = await fetch(
    buildUrl(`/entities/${COLLECTION}/${encodeURIComponent(id)}`),
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ data }),
    },
  );

  if (updateResponse.status === 404) {
    const createResponse = await fetch(buildUrl(`/entities/${COLLECTION}`), {
      method: "POST",
      headers,
      body: JSON.stringify({ id, data }),
    });
    return parseJson(createResponse);
  }

  return parseJson(updateResponse);
}

export function connectProjectAlphaEvents(onEvent) {
  const stream = new EventSource(buildUrl("/events"));
  stream.onmessage = (event) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {
      /* ignore malformed events */
    }
  };
  return stream;
}

export { COLLECTION as LEADERBOARD_COLLECTION };
