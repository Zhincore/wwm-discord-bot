import { Client } from 'discord.js';

type DeepMerge<T, U> = [T, U] extends [Record<string, any>, Record<string, any>]
  ? {
      [K in keyof T | keyof U]: K extends keyof U
        ? K extends keyof T
          ? DeepMerge<T[K], U[K]>
          : U[K]
        : K extends keyof T
          ? T[K]
          : never;
    }
  : U;

const isObject = (item: unknown): item is Record<string, any> =>
  Boolean(item && typeof item === 'object' && !Array.isArray(item));

export function deepMerge<
  T extends Record<string, any>,
  U extends Record<string, any>,
>(target: T, source: U): DeepMerge<T, U>;
export function deepMerge<
  T extends Record<string, any>,
  U extends Record<string, any>,
  V extends Record<string, any>,
>(target: T, source1: U, source2: V): DeepMerge<DeepMerge<T, U>, V>;
export function deepMerge(
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any>;
export function deepMerge(
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any> {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;

      if (isObject(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return deepMerge(target, ...sources);
}

export async function fetchJSON<T>(
  input: string | URL | Request,
  init?: BunFetchRequestInit,
) {
  const response = await fetch(input, init);
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText} -- (${input})`);

  return response.json() as Promise<T>;
}

export async function onceReady(client: Client) {
  if (client.isReady()) return client;

  return await new Promise<Client<true>>((resolve, reject) => {
    client.once('error', reject);
    client.once('clientReady', (c) => {
      client.off('error', reject);
      resolve(c);
    });
  });
}
