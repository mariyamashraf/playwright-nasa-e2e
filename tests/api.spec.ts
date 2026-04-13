import { expect, test } from '@playwright/test';
import {
  ApiHelper,
  assertAssetResponseShape,
  assertJsonContentType,
  assertSearchResponseShape,
  type NasaAssetResponse,
} from '../utils/apiHelper';

const SEARCH_TERM = 'moon';

/**
 * Task B — API: Search and fetch asset details
 *
 * Uses Playwright's APIRequestContext (via `request` fixture) against the
 * NASA Images REST API (baseURL: https://images-api.nasa.gov).
 */
test.describe('NASA Image API', () => {

  // ── Happy-path search ──────────────────────────────────────────────────

  test('API - search returns 200, valid schema, and ≥1 result with title and nasa_id', async ({ request }) => {
    const api = new ApiHelper(request);

    const response = await api.search(SEARCH_TERM);
    expect(response.status(), 'GET /search must return HTTP 200').toBe(200);
    assertJsonContentType(response);

    const body = await response.json();
    assertSearchResponseShape(body);

    expect(body.collection.items.length, 'Search must return at least one item').toBeGreaterThan(0);
    expect(body.collection.metadata.total_hits, 'total_hits must be > 0').toBeGreaterThan(0);

    const firstData = body.collection.items[0].data[0];
    expect(firstData.title, 'First item must have a non-empty title').toBeTruthy();
    expect(firstData.nasa_id, 'First item must have a non-empty nasa_id').toBeTruthy();

    // media_type should be 'image' because we filtered by media_type=image
    expect(firstData.media_type, 'media_type must be "image"').toBe('image');
  });

  // ── Asset details ──────────────────────────────────────────────────────

  test('API - asset details return 200 and ≥1 downloadable absolute URL', async ({ request }) => {
    const api = new ApiHelper(request);
    const firstItem = await api.getFirstSearchResult(SEARCH_TERM);
    const nasaId = firstItem.data[0].nasa_id;

    expect(nasaId, 'nasa_id must be truthy before fetching asset').toBeTruthy();

    const assetResponse = await api.getAsset(nasaId);
    expect(assetResponse.status(), `GET /asset/${nasaId} must return HTTP 200`).toBe(200);
    assertJsonContentType(assetResponse);

    const body: NasaAssetResponse = await assetResponse.json();
    assertAssetResponseShape(body);

    const assetUrls = body.collection.items.map((item) => item.href).filter(Boolean);
    expect(assetUrls.length, 'Asset must list ≥1 downloadable URL').toBeGreaterThan(0);
    expect(assetUrls[0], 'First asset URL must be absolute').toMatch(/^https?:\/\//);
  });

  // ── Metadata endpoint (bonus coverage) ────────────────────────────────

  test('API - metadata endpoint returns 200 and a location URL', async ({ request }) => {
    const api = new ApiHelper(request);
    const firstItem = await api.getFirstSearchResult(SEARCH_TERM);
    const nasaId = firstItem.data[0].nasa_id;

    const metaResponse = await api.getMetadata(nasaId);
    expect(metaResponse.status(), `GET /metadata/${nasaId} must return HTTP 200`).toBe(200);
    assertJsonContentType(metaResponse);

    const body = await metaResponse.json();
    expect(body.location, 'metadata.location must be a non-empty string').toBeTruthy();
    expect(body.location, 'metadata.location must be an absolute URL').toMatch(/^https?:\/\//);
  });

  // ── Negative tests ─────────────────────────────────────────────────────

  /**
   * NASA returns HTTP 200 with `items: []` and `total_hits: 0` for queries
   * that match nothing — it does NOT return a 4xx error.
   */
  test('API - nonsense query returns 200 with empty items and total_hits: 0', async ({ request }) => {
    const api = new ApiHelper(request);

    const response = await api.search('xq7zzz99nonsense12345');
    expect(response.status(), 'Nonsense search must return HTTP 200').toBe(200);
    assertJsonContentType(response);

    const body = await response.json();
    assertSearchResponseShape(body);
    expect(body.collection.items, 'Nonsense search must return no items').toEqual([]);
    expect(body.collection.metadata.total_hits, 'total_hits must be 0').toBe(0);
  });

  /**
   * Empty `q` is not an error for this API: NASA treats it as a broad browse
   * and returns items. This documents the observed behaviour so the test acts
   * as a specification, not an assumption.
   */
  test('API - empty query returns 200 and non-empty browse results (documented NASA behaviour)', async ({ request }) => {
    const api = new ApiHelper(request);

    const response = await api.search('');
    expect(response.status(), 'Empty query must return HTTP 200').toBe(200);
    assertJsonContentType(response);

    const body = await response.json();
    assertSearchResponseShape(body);
    expect(body.collection.items.length, 'Empty query browse must return ≥1 item').toBeGreaterThan(0);
    expect(body.collection.metadata.total_hits, 'total_hits must be > 0 for browse').toBeGreaterThan(0);
  });
});
