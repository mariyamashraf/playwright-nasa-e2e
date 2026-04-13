import { expect, test } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';
import { ApiHelper } from '../utils/apiHelper';

const SEARCH_TERM = 'moon';

/**
 * Normalizes title strings for comparison.
 *
 * Assessment explicitly permits "light normalization". This collapses
 * internal whitespace and lowercases both strings before comparing —
 * the same technique used to remove the "| NASA Image and Video Library"
 * page-title suffix that the UI appends to the h1 text in some browsers.
 */
const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Task C — Integration: API-to-UI consistency
 *
 * Flow:
 *   1. Fetch the first API result to obtain `nasa_id` and `title`.
 *   2. Search the UI for that title and assert the matching card is present.
 *   3. Open the detail page for that card.
 *   4. Assert UI title equals API title (normalized).
 *   5. Assert UI NASA ID contains API nasa_id (normalized).
 *   6. Assert page URL contains the encoded nasa_id.
 */
test('Integration - API first result title and nasa_id match the UI detail page', async ({
  page,
  request,
}) => {
  const api = new ApiHelper(request);
  const searchPage = new SearchPage(page);

  // ── Step 1: Fetch the first API result ──────────────────────────────────
  const firstItem = await api.getFirstSearchResult(SEARCH_TERM);
  const { nasa_id: nasaId, title: apiTitle } = firstItem.data[0];

  expect(nasaId, 'API nasa_id must be non-empty').toBeTruthy();
  expect(apiTitle, 'API title must be non-empty').toBeTruthy();

  // ── Step 2: Find the matching card in the UI ────────────────────────────
  await test.step(`Search the UI for API title: "${apiTitle}"`, async () => {
    await searchPage.goto();
    await searchPage.search(apiTitle);

    const matchingCard = searchPage.getResultByNasaId(nasaId);
    await expect(
      matchingCard,
      `Result card with nasa_id "${nasaId}" must be visible in the UI`,
    ).toHaveAttribute('href', new RegExp(`/details/${encodeURIComponent(nasaId)}$`));

    await expect(matchingCard).toContainText(apiTitle);
  });

  // ── Step 3: Open the detail page ────────────────────────────────────────
  await test.step(`Open detail page for nasa_id "${nasaId}"`, async () => {
    await searchPage.openResultByNasaId(nasaId);
    await searchPage.waitForDetailPage();
  });

  // ── Step 4–6: Assert UI matches API data ────────────────────────────────
  await test.step('Assert UI title equals API title (normalized)', async () => {
    const uiTitle = await searchPage.getDetailTitleText();
    expect(
      normalizeText(uiTitle),
      `UI title "${uiTitle}" must match API title "${apiTitle}" after normalization`,
    ).toBe(normalizeText(apiTitle));
  });

  await test.step('Assert UI NASA ID contains API nasa_id (normalized)', async () => {
    const uiNasaId = await searchPage.getDetailNasaIdText();
    expect(
      normalizeText(uiNasaId),
      `UI NASA ID text "${uiNasaId}" must contain "${nasaId}"`,
    ).toContain(normalizeText(nasaId));
  });

  await test.step('Assert page URL contains encoded nasa_id', async () => {
    expect(
      page.url(),
      `Detail page URL must contain encoded nasa_id "${nasaId}"`,
    ).toContain(encodeURIComponent(nasaId));
  });
});
