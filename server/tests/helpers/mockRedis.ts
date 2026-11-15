// In-memory Redis stand-in shared by tests via vi.mock in each test file.
// Captures TTLs so session-lifetime assertions (Finding B) can run.
export type RedisEntry = { value: string; ttlSeconds?: number };

export const createRedisMock = () => {
  const store = new Map<string, RedisEntry>();
  const setCalls: Array<{ key: string; ttlSeconds?: number }> = [];
  const sets = new Map<string, Set<string>>();

  const set = async (
    key: string,
    value: string,
    flag?: string,
    ttl?: number
  ) => {
    const ttlSeconds = flag === "EX" ? ttl : undefined;
    store.set(key, { value, ttlSeconds });
    setCalls.push({ key, ttlSeconds });
    return "OK";
  };

  return {
    store,
    setCalls,
    redis: {
      get: async (key: string) => store.get(key)?.value ?? null,
      set,
      del: async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (store.delete(key) || sets.delete(key)) deleted += 1;
        }
        return deleted;
      },
      sadd: async (key: string, ...members: string[]) => {
        const values = sets.get(key) ?? new Set<string>();
        const initialSize = values.size;
        members.forEach((member) => values.add(member));
        sets.set(key, values);
        return values.size - initialSize;
      },
      srem: async (key: string, ...members: string[]) => {
        const values = sets.get(key);
        if (!values) return 0;
        let removed = 0;
        members.forEach((member) => {
          if (values.delete(member)) removed += 1;
        });
        if (values.size === 0) sets.delete(key);
        return removed;
      },
      smembers: async (key: string) => [...(sets.get(key) ?? [])],
      expire: async () => 1,
      mget: async (...keys: string[]) =>
        keys.map((k) => store.get(k)?.value ?? null),
    },
  };
};
