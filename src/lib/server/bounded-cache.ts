/**
 * Small TTL + LRU cache. Map preserves insertion order, so re-inserting on
 * read keeps the most recently used entries last and the oldest first, which
 * makes eviction a single `keys().next()`.
 */
export class BoundedCache<V> {
  private readonly store = new Map<string, { expires: number; value: V }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);
    this.store.set(key, { expires: Date.now() + this.ttlMs, value });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}
