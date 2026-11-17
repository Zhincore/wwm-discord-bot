import type { UnionToIntersection } from 'drizzle-orm';

import type { Endpoints } from './wwm-api';

const ENDPOINT_RE = /^([A-Z]+) (\/.+)$/;
/** Typecheck of endpoint key formatting */
((): `${Uppercase<string>} /${string}` => null as unknown as keyof Endpoints)();

/** Typed REST client of the game API */
export class WwmProxy {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  public async fetch<T extends keyof Endpoints>(
    endpoint: T,
    params: FetchParams<T>,
  ): Promise<EndpointResponse<T>> {
    const p = params as unknown as UnionToIntersection<
      Endpoints[keyof Endpoints]
    > & { params?: Record<string, string> };

    const parsedEndpoint = ENDPOINT_RE.exec(endpoint);
    if (!parsedEndpoint) throw new Error('Unexpected endpoint format');
    const method = parsedEndpoint[1];
    let path = parsedEndpoint[2];
    for (const [key, value] of Object.entries(p.params || {})) {
      path = path?.replace(`{${key}}`, encodeURIComponent(value || ''));
    }

    const query = new URLSearchParams(p.query as Record<string, string>);

    const response = await fetch(this.baseUrl + path + '?' + query, {
      method,
      body: p.body ? JSON.stringify(p.body) : undefined,
      headers: {
        Authorization: 'Bearer ' + this.token,
        ...(p.body ? { 'content-type': 'application/json' } : {}),
      },
    });

    if (response.ok) {
      return response.json() as Promise<EndpointResponse<T>>;
    }

    let error: unknown = await response.text().catch(() => undefined);
    try {
      error = error && JSON.parse(error as string);
    } catch {
      /* ignored */
    }

    if (error) {
      if (typeof error === 'object' && 'detail' in error) {
        throw new Error(error.detail + '');
      }
      throw new Error(error + '');
    }
    throw new Error(`Error fetching WWM Proxy API: ${response.statusText}`);
  }
}

type EndpointResponse<Endpoint extends keyof Endpoints> =
  Endpoints[Endpoint]['response'];

type EndpointParams<Endpoint extends string> =
  Endpoint extends `${string}/{${infer P extends string}}${infer Rest}`
    ? { [K in P]: string } & EndpointParams<Rest>
    : {};

type FetchParams<Endpoint extends keyof Endpoints> = Omit<
  Endpoints[Endpoint],
  'response'
> &
  ({} extends EndpointParams<Endpoint>
    ? {}
    : { params: EndpointParams<Endpoint> });
