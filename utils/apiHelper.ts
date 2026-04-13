import { APIRequestContext, APIResponse, expect } from '@playwright/test';

// ─── Shared types ────────────────────────────────────────────────────────────

export type NasaData = {
  nasa_id: string;
  title: string;
  description?: string;
  date_created?: string;
  media_type?: string;
  keywords?: string[];
  center?: string;
};

export type NasaItem = {
  data: NasaData[];
  href?: string;
  links?: Array<{ href: string; render?: string; rel?: string }>;
};

/** Shape returned by `GET /search` */
export type NasaSearchResponse = {
  collection: {
    version: string;
    href: string;
    items: NasaItem[];
    metadata: { total_hits: number };
    links?: Array<{ href: string; rel?: string; prompt?: string }>;
  };
};

/** Shape returned by `GET /asset/{id}` (download links; no metadata). */
export type NasaAssetResponse = {
  collection: {
    version: string;
    href: string;
    items: Array<{ href: string }>;
  };
};

// ─── Guard helpers ───────────────────────────────────────────────────────────

/**
 * NASA Images API serves JSON.
 * Validates Content-Type before calling `response.json()` to catch HTML error
 * pages or proxy responses early and surface them as assertion failures.
 */
export function assertJsonContentType(response: APIResponse) {
  const header = response.headers()['content-type'] ?? '';
  expect(header, 'Response Content-Type must be application/json').toMatch(
    /application\/json/i,
  );
}

/**
 * Validates the shape of a `/search` response body.
 * Fails with descriptive assertion messages rather than undefined-access errors.
 */
export function assertSearchResponseShape(body: NasaSearchResponse) {
  expect(body.collection, 'search response must include collection').toBeDefined();
  expect(body.collection.version, 'collection.version').toMatch(/^\d+\.\d+$/);
  expect(typeof body.collection.href, 'collection.href must be a string').toBe('string');
  expect(Array.isArray(body.collection.items), 'collection.items must be an array').toBe(true);
  expect(body.collection.metadata, 'search response must include metadata').toBeDefined();
  expect(
    typeof body.collection.metadata.total_hits,
    'metadata.total_hits must be a number',
  ).toBe('number');
}

/**
 * Validates the shape of a `/asset/{id}` response body.
 * Also asserts that every item exposes an absolute URL.
 */
export function assertAssetResponseShape(body: NasaAssetResponse) {
  expect(body.collection, 'asset response must include collection').toBeDefined();
  expect(body.collection.version, 'collection.version').toMatch(/^\d+\.\d+$/);
  expect(Array.isArray(body.collection.items), 'collection.items must be an array').toBe(true);
  expect(body.collection.items.length, 'asset must list at least one file').toBeGreaterThan(0);
  for (const item of body.collection.items) {
    expect(item.href, 'each asset item must have an href').toBeTruthy();
    expect(item.href, 'each asset href must be an absolute URL').toMatch(/^https?:\/\//);
  }
}

// ─── API helper class ────────────────────────────────────────────────────────

export class ApiHelper {
  /** NASA Images REST API base URL — configured as `baseURL` in playwright.config.ts */
  static readonly BASE_URL = 'https://images-api.nasa.gov';

  constructor(private readonly request: APIRequestContext) {}

  // ── Raw request methods ──────────────────────────────────────────────────

  /** `GET /search?q=…&media_type=image&page=…` */
  async search(term: string, page = 1): Promise<APIResponse> {
    return this.request.get('/search', {
      params: {
        q: term,
        media_type: 'image',
        page,
      },
    });
  }

  /** `GET /asset/{nasa_id}` — list of downloadable file URLs */
  async getAsset(nasaId: string): Promise<APIResponse> {
    return this.request.get(`/asset/${encodeURIComponent(nasaId)}`);
  }

  /** `GET /metadata/{nasa_id}` — location of the JSON metadata sidecar file */
  async getMetadata(nasaId: string): Promise<APIResponse> {
    return this.request.get(`/metadata/${encodeURIComponent(nasaId)}`);
  }

  // ── Convenience helpers ──────────────────────────────────────────────────

  /** Search and return the parsed body (asserts 200 + JSON content-type). */
  async getSearchResults(term: string, page = 1): Promise<NasaSearchResponse> {
    const response = await this.search(term, page);
    expect(response.status(), `GET /search?q=${term} must return 200`).toBe(200);
    assertJsonContentType(response);
    return response.json();
  }

  /** Fetch `/asset/{id}` and return the parsed body (asserts 200 + JSON). */
  async getAssetDetails(nasaId: string): Promise<NasaAssetResponse> {
    const response = await this.getAsset(nasaId);
    expect(response.status(), `GET /asset/${nasaId} must return 200`).toBe(200);
    assertJsonContentType(response);
    return response.json();
  }

  /** Return the first item from a search or throw a descriptive error. */
  async getFirstSearchResult(term: string): Promise<NasaItem> {
    const body = await this.getSearchResults(term);
    const firstItem = body.collection.items[0];

    if (!firstItem) {
      throw new Error(`No NASA image results returned for query: "${term}"`);
    }

    return firstItem;
  }

  /** Return all downloadable asset URLs for a NASA ID. */
  async getDownloadableAssetUrls(nasaId: string): Promise<string[]> {
    const body = await this.getAssetDetails(nasaId);

    return body.collection.items
      .map((item) => item.href)
      .filter((href): href is string => Boolean(href));
  }

  /**
   * Return the highest-resolution image URL from the asset manifest.
   * Prefers files with the `~orig` suffix; falls back to any recognised
   * image extension.
   */
  async getOriginalImageUrl(nasaId: string): Promise<string | undefined> {
    const urls = await this.getDownloadableAssetUrls(nasaId);
    const origUrl = urls.find((u) => u.includes('~orig.'));
    return origUrl ?? urls.find((u) => /\.(jpg|jpeg|png|tif|tiff)$/i.test(u));
  }
}
