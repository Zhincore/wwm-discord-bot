import { CacheMap } from './cache-map.js';

interface FetchCacheOptions {
  /** Max entries; least recently used evicted first. */
  maxSize?: number;
  /** Entry lifetime in ms. */
  ttl?: number;
}

/**
 * Read-through cache: `get` returns the cached value or runs `fetcher`.
 * Concurrent misses for one key share a single in-flight promise; rejections are not cached.
 */
export class FetchCache<K, V> {
  readonly #cache: CacheMap<K, V>;
  readonly #inflight = new Map<K, Promise<V>>();

  constructor(
    private readonly fetcher: (key: K) => Promise<V>,
    options: FetchCacheOptions = {},
  ) {
    this.#cache = new CacheMap<K, V>(options);
  }

  async get(key: K): Promise<V> {
    const cached = this.#cache.get(key);
    if (cached !== undefined) return cached;

    const pending = this.#inflight.get(key);
    if (pending) return pending;

    const promise = this.fetcher(key)
      .then((value) => {
        this.#cache.set(key, value);
        return value;
      })
      .finally(() => this.#inflight.delete(key));

    this.#inflight.set(key, promise);
    return promise;
  }

  peek(key: K) {
    return this.#cache.get(key);
  }

  set(key: K, value: V, ttl?: number) {
    this.#cache.set(key, value, ttl);
    return this;
  }

  /** Drop cached value; next `get` refetches. In-flight fetch unaffected. */
  invalidate(key: K) {
    return this.#cache.delete(key);
  }

  clear() {
    this.#cache.clear();
  }
}
