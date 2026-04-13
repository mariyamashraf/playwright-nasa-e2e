import { expect, test } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';

const SEARCH_TERM = 'moon';

/**
 * Task A — UI: Search and validate a media result
 *
 * Flow:
 *   1. Navigate to the NASA Image and Video Library homepage.
 *   2. Search for SEARCH_TERM.
 *   3. Filter to images only (uncheck video + audio).
 *   4. Assert ≥ 5 image results are visible.
 *   5. Open the first image result's detail page.
 *   6. Assert the detail title (h1) is visible.
 *   7. Assert the NASA ID label matches the ID from the search-result URL.
 *   8. Assert the preview image URL resolves to a real image response.
 */
test('UI - search and validate image result', async ({ page }) => {
  const searchPage = new SearchPage(page);
  let firstResultNasaId = '';

  await test.step('Navigate to NASA Image Library homepage', async () => {
    await searchPage.goto();
  });

  await test.step(`Search for "${SEARCH_TERM}"`, async () => {
    await searchPage.search(SEARCH_TERM);
  });

  await test.step('Filter to image results only and assert ≥ 5 are visible', async () => {
    await searchPage.filterToImagesOnly();

    const visibleCount = await searchPage.getVisibleImageResultCount();
    expect(
      visibleCount,
      `Expected at least 5 visible image results for "${SEARCH_TERM}"`,
    ).toBeGreaterThanOrEqual(5);

    // Capture NASA ID from the first result href for use in later steps
    const firstHref = await searchPage.imageResults.first().getAttribute('href');
    expect(firstHref, 'First image result must have an href').toBeTruthy();
    firstResultNasaId = decodeURIComponent(firstHref!.split('/').pop()!);
    expect(firstResultNasaId, 'NASA ID extracted from href must be non-empty').toBeTruthy();
  });

  await test.step('Open the first image result detail page', async () => {
    await searchPage.openFirstImageResult();
    await searchPage.waitForDetailPage();
  });

  await test.step('Assert detail page title (h1) is visible', async () => {
    await expect(searchPage.detailTitle).toBeVisible();
    const title = await searchPage.getDetailTitleText();
    expect(title.length, 'Detail title must not be empty').toBeGreaterThan(0);
  });

  await test.step('Assert detail page NASA ID matches search-result URL', async () => {
    await expect(searchPage.detailNasaId).toContainText(firstResultNasaId);
  });

  await test.step('Assert preview image loads (HTTP 200 + image/* Content-Type)', async () => {
    await searchPage.assertPreviewImageLoads();
  });
});
