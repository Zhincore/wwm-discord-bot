interface CacheMapOptions {
  /** Max entries; least recently used evicted first. */
  maxSize?: number;
  /** Entry lifetime in ms. */
  ttl?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * LRU + TTL map. Expired entries are swept by one unref'd timer
 * scheduled for the earliest expiry, so the cache never keeps the process alive.
 */
export class CacheMap<K, V> {
  readonly #map = new Map<K, Entry<V>>();
  readonly #maxSize: number;
  readonly #ttl: number;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #timerAt = Infinity;

  constructor({ maxSize = Infinity, ttl = Infinity }: CacheMapOptions = {}) {
    this.#maxSize = maxSize;
    this.#ttl = ttl;
  }

  get size() {
    return this.#map.size;
  }

  has(key: K) {
    return this.get(key) !== undefined;
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.#map.delete(key);
      return undefined;
    }
    this.#map.delete(key);
    this.#map.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttl = this.#ttl) {
    const expiresAt = Date.now() + ttl;
    this.#map.delete(key);
    this.#map.set(key, { value, expiresAt });

    while (this.#map.size > this.#maxSize) {
      this.#map.delete(this.#map.keys().next().value!);
    }

    if (expiresAt < this.#timerAt) this.#schedule(expiresAt);
    return this;
  }

  delete(key: K) {
    return this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
    this.#stopTimer();
  }

  *entries(): IterableIterator<[K, V]> {
    const now = Date.now();
    for (const [key, entry] of this.#map) {
      if (entry.expiresAt > now) yield [key, entry.value];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  #schedule(at: number) {
    this.#stopTimer();
    if (!Number.isFinite(at)) return;
    this.#timerAt = at;
    this.#timer = setTimeout(() => this.#sweep(), Math.max(0, at - Date.now()));
    this.#timer.unref?.();
  }

  #stopTimer() {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#timerAt = Infinity;
  }

  #sweep() {
    const now = Date.now();
    let next = Infinity;
    for (const [key, entry] of this.#map) {
      if (entry.expiresAt <= now) this.#map.delete(key);
      else if (entry.expiresAt < next) next = entry.expiresAt;
    }
    this.#stopTimer();
    if (next !== Infinity) this.#schedule(next);
  }
}
