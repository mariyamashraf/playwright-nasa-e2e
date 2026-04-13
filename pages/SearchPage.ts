import { expect, Locator, Page } from '@playwright/test';

const DETAIL_ROUTE_PATTERN = /\/details\//;
const DETAIL_TITLE_SUFFIX = /\s*\|\s*NASA Image and Video Library$/i;

const normalizeProtocolRelativeUrl = (value: string) =>
  value.startsWith('//')
    ? `https:${value}`
    : value.startsWith('http')
    ? value
    : `https://${value}`;

const escapeForRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Page Object ─────────────────────────────────────────────────────────────

export class SearchPage {
  readonly page: Page;

  // ── Homepage / search bar ────────────────────────────────────────────────
  readonly searchInput: Locator;

  // ── Filter checkboxes ────────────────────────────────────────────────────
  readonly imageCheckbox: Locator;
  readonly videoCheckbox: Locator;
  readonly audioCheckbox: Locator;

  // ── Result cards ─────────────────────────────────────────────────────────
  /** All result links (Date Created: present) — used for cross-type counts */
  readonly resultLinks: Locator;
  /** Image-only result anchors */
  readonly imageResults: Locator;

  // ── Detail page ──────────────────────────────────────────────────────────
  readonly detailTitle: Locator;
  readonly detailNasaId: Locator;
  readonly assetUrlField: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchInput = page
      .getByRole('search', { name: /sitewide/i })
      .getByRole('textbox')
      .first();

    this.imageCheckbox = page.getByRole('checkbox', { name: /images/i }).first();
    this.videoCheckbox = page.getByRole('checkbox', { name: /videos/i }).first();
    this.audioCheckbox = page.getByRole('checkbox', { name: /audio/i }).first();

    this.resultLinks = page
      .locator('main')
      .getByRole('link')
      .filter({ hasText: /Date Created:/ });

    this.imageResults = page.locator('a.image-asset');

    this.detailTitle = page.getByRole('heading', { level: 1 }).first();
    this.detailNasaId = page.getByText(/NASA ID:\s*/).first();
    this.assetUrlField = page
      .getByRole('textbox', { name: /copy asset url to clipboard/i })
      .first();
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  async goto() {
    // domcontentloaded prevents Firefox/WebKit from timing out on slow
    // third-party scripts that block the load event on images.nasa.gov
    await this.page.goto('https://images.nasa.gov', { waitUntil: 'domcontentloaded' });
    await expect(this.searchInput).toBeVisible({ timeout: 15_000 });
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(term: string) {
    await this.searchInput.fill(term);

    // Enter submits in Chromium/WebKit; Firefox often leaves the URL on /
    // unless the explicit Submit button inside the sitewide search region is used.
    const searchRegion = this.page.getByRole('search', { name: /sitewide/i });
    const submitButton = searchRegion.getByRole('button', { name: /submit/i }).first();
    await submitButton.click();

    const onSearchUrl = /\/search(?:\?|$)/;
    try {
      await expect(this.page).toHaveURL(onSearchUrl, { timeout: 8_000 });
    } catch {
      // Firefox fallback
      await this.searchInput.press('Enter');
    }

    await expect(this.page).toHaveURL(onSearchUrl, { timeout: 15_000 });
    await expect(
      this.page.getByRole('heading', {
        level: 2,
        name: new RegExp(`^\\s*showing results for "${escapeForRegex(term)}"`, 'i'),
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.resultLinks.first()).toHaveAttribute('href', /\/details\//, {
      timeout: 15_000,
    });
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  async filterToImagesOnly() {
    // Images checkbox should already be checked by default
    await expect(this.imageCheckbox).toBeChecked();
    await this.videoCheckbox.uncheck({ force: true });
    await this.audioCheckbox.uncheck({ force: true });

    await expect(this.videoCheckbox).not.toBeChecked();
    await expect(this.audioCheckbox).not.toBeChecked();
    await expect(this.imageResults.first()).toHaveAttribute('href', /\/details\//, {
      timeout: 15_000,
    });
  }

  // ── Result accessors ─────────────────────────────────────────────────────

  async getVisibleImageResultCount() {
    return this.imageResults.evaluateAll((nodes) =>
      nodes.filter((node) => Boolean((node as Element).getClientRects().length)).length,
    );
  }

  /** Locates a result card whose href contains the encoded nasa_id. */
  getResultByNasaId(nasaId: string): Locator {
    return this.page
      .locator(`main a[href*="/details/${encodeURIComponent(nasaId)}"]`)
      .filter({ hasText: /Date Created:/ })
      .first();
  }

  // ── Navigation to details ─────────────────────────────────────────────────

  async openFirstImageResult() {
    await this.openResult(this.imageResults.first());
  }

  async openResultByNasaId(nasaId: string) {
    const result = this.getResultByNasaId(nasaId);
    await expect(result).toHaveAttribute(
      'href',
      new RegExp(`/details/${encodeURIComponent(nasaId)}$`),
      { timeout: 15_000 },
    );
    await this.openResult(result);
  }

  // ── Detail page helpers ───────────────────────────────────────────────────

  async waitForDetailPage() {
    await expect(this.detailTitle).toBeVisible({ timeout: 20_000 });
    await expect(this.detailNasaId).toBeVisible({ timeout: 20_000 });
  }

  async getDetailTitleText(): Promise<string> {
    const raw = await this.detailTitle.innerText();
    // Strip the "| NASA Image and Video Library" document-title suffix if present
    return raw.replace(DETAIL_TITLE_SUFFIX, '').trim();
  }

  async getDetailNasaIdText(): Promise<string> {
    return this.detailNasaId.innerText();
  }

  /**
   * Validates the preview image by:
   * 1. Reading the asset URL from the "Copy asset URL" clipboard field (more
   *    reliable than inspecting the lazy-loaded `<img>` src in headless mode).
   * 2. Fetching the URL and asserting HTTP 200 + `image/*` Content-Type.
   */
  async assertPreviewImageLoads() {
    await expect(this.assetUrlField).toHaveValue(/images-assets\.nasa\.gov/i, {
      timeout: 20_000,
    });

    const raw = await this.assetUrlField.inputValue();
    const assetUrl = normalizeProtocolRelativeUrl(raw);

    const response = await fetch(assetUrl, {
      signal: AbortSignal.timeout(20_000),
    });

    expect(response.ok, `Asset URL should return 2xx — got ${response.status}`).toBeTruthy();
    expect(response.headers.get('content-type') ?? '', 'Asset must be an image').toContain(
      'image/',
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Navigates directly to the detail page via its href attribute.
   *
   * Angular's router does not reliably respond to Playwright's synthetic
   * element.click() — extracting the href and calling page.goto() is the
   * only approach that works consistently across all three browsers.
   */
  private async openResult(result: Locator) {
    const href = await result.getAttribute('href');
    if (!href) throw new Error('Result element has no href attribute');

    const url = href.startsWith('http') ? href : `https://images.nasa.gov${href}`;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(DETAIL_ROUTE_PATTERN, { timeout: 15_000 });
  }
}
