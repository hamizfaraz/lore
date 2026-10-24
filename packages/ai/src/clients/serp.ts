import { createHash } from 'node:crypto';

import { getJson } from 'serpapi';

import { getAiConfig, requireLiveValue, type AiConfig } from '../config.js';

export interface SerpCache {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
}

export interface SerpSearchResult {
  engine: 'google' | 'google_events' | 'google_maps' | 'google_news';
  query: string;
  fetchedAt: string;
  cached: boolean;
  raw: Record<string, unknown>;
}

export interface SerpSearchOptions {
  q: string;
  location?: string;
  extra?: Record<string, string | number | boolean | undefined>;
}

const CACHE_SECONDS = 6 * 60 * 60;

function cacheKey(engine: string, parameters: Record<string, unknown>): string {
  const stableEntries = Object.entries(parameters)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `lore:serp:${engine}:${createHash('sha256').update(JSON.stringify(stableEntries)).digest('hex')}`;
}

export class SerpClient {
  constructor(
    private readonly cache?: SerpCache,
    private readonly config: AiConfig = getAiConfig(),
  ) {}

  events(options: SerpSearchOptions): Promise<SerpSearchResult> {
    return this.search('google_events', options);
  }

  places(options: SerpSearchOptions): Promise<SerpSearchResult> {
    return this.search('google_maps', options);
  }

  mediaLookup(options: SerpSearchOptions): Promise<SerpSearchResult> {
    return this.search('google', options);
  }

  news(options: SerpSearchOptions): Promise<SerpSearchResult> {
    return this.search('google_news', options);
  }

  private async search(
    engine: SerpSearchResult['engine'],
    options: SerpSearchOptions,
  ): Promise<SerpSearchResult> {
    if (this.config.mode === 'mock') {
      return {
        engine,
        query: options.q,
        fetchedAt: new Date(0).toISOString(),
        cached: true,
        raw: {
          search_metadata: { status: 'Success', mock: true },
          search_parameters: { engine, q: options.q },
          events_results: [],
          local_results: [],
          news_results: [],
          organic_results: [],
        },
      };
    }
    const apiKey = requireLiveValue(this.config.serpApiKey, 'SERPAPI_KEY');
    const parameters = {
      q: options.q,
      ...(options.location ? { location: options.location } : {}),
      ...(options.extra ?? {}),
    };
    const key = cacheKey(engine, parameters);
    const cached = await this.cache?.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as Omit<SerpSearchResult, 'cached'>;
      return { ...parsed, cached: true };
    }

    const raw = (await getJson(engine, {
      api_key: apiKey,
      ...parameters,
    })) as unknown as Record<string, unknown>;
    const result: SerpSearchResult = {
      engine,
      query: options.q,
      fetchedAt: new Date().toISOString(),
      cached: false,
      raw,
    };
    await this.cache?.setEx(key, CACHE_SECONDS, JSON.stringify(result));
    return result;
  }
}
