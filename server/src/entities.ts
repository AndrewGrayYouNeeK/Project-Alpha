import { randomUUID } from 'node:crypto';
import type { createClient } from 'redis';
import { isCollectionName, isEntityRecord, type EntityRecord } from '../../shared/src';

const ENTITY_PREFIX = 'project-alpha:entity';

type RedisClient = ReturnType<typeof createClient>;

const entityKey = (collection: string, id: string): string => `${ENTITY_PREFIX}:${collection}:${id}`;
const indexKey = (collection: string): string => `${ENTITY_PREFIX}:${collection}:ids`;

const parseEntity = (raw: string | null): EntityRecord | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isEntityRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export class EntityStore {
  constructor(private readonly redis: RedisClient) {}

  async list(collection: string): Promise<EntityRecord[]> {
    if (!isCollectionName(collection)) {
      throw new Error('Invalid collection name');
    }

    const ids = await this.redis.sMembers(indexKey(collection));
    if (ids.length === 0) {
      return [];
    }

    const keys = ids.map((id) => entityKey(collection, id));
    const values = await this.redis.mGet(keys);

    const records: EntityRecord[] = [];
    for (const value of values) {
      const record = parseEntity(value);
      if (record) {
        records.push(record);
      }
    }

    return records.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async get(collection: string, id: string): Promise<EntityRecord | null> {
    if (!isCollectionName(collection)) {
      throw new Error('Invalid collection name');
    }

    const raw = await this.redis.get(entityKey(collection, id));
    return parseEntity(raw);
  }

  async create(collection: string, data: Record<string, unknown>, id?: string): Promise<EntityRecord> {
    if (!isCollectionName(collection)) {
      throw new Error('Invalid collection name');
    }

    const recordId = id?.trim() || randomUUID();
    const now = new Date().toISOString();
    const record: EntityRecord = {
      id: recordId,
      data,
      createdAt: now,
      updatedAt: now,
    };

    const key = entityKey(collection, recordId);
    const created = await this.redis.set(key, JSON.stringify(record), { NX: true });
    if (!created) {
      throw new Error('Entity already exists');
    }

    await this.redis.sAdd(indexKey(collection), recordId);
    return record;
  }

  async update(collection: string, id: string, data: Record<string, unknown>): Promise<EntityRecord | null> {
    if (!isCollectionName(collection)) {
      throw new Error('Invalid collection name');
    }

    const key = entityKey(collection, id);
    const existing = parseEntity(await this.redis.get(key));
    if (!existing) {
      return null;
    }

    const updated: EntityRecord = {
      ...existing,
      data,
      updatedAt: new Date().toISOString(),
    };

    await this.redis.set(key, JSON.stringify(updated));
    return updated;
  }

  async delete(collection: string, id: string): Promise<boolean> {
    if (!isCollectionName(collection)) {
      throw new Error('Invalid collection name');
    }

    const key = entityKey(collection, id);
    const removed = await this.redis.del(key);
    if (removed === 0) {
      return false;
    }

    await this.redis.sRem(indexKey(collection), id);
    return true;
  }
}
