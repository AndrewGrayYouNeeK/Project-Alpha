export type RealtimeEvent = {
  type: string;
  payload: unknown;
  timestamp: string;
};

export const isRealtimeEvent = (value: unknown): value is RealtimeEvent => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === 'string' &&
    candidate.type.length > 0 &&
    typeof candidate.timestamp === 'string' &&
    !Number.isNaN(Date.parse(candidate.timestamp))
  );
};
