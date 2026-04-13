# Test Plan — NASA Image & Video Library (Playwright Assessment)

**Search term used throughout:** `moon`
**Date:** April 2026
**Scope:** UI automation, REST API validation, API-to-UI integration

---

## What Is Covered

### A — UI (ui.spec.ts)

| Area | Assertion |
|---|---|
| Homepage loads | `searchInput` is visible within 15 s |
| Search submit (cross-browser) | URL changes to `/search?…`; results heading matches term |
| Image-only filter | Video and audio checkboxes unchecked; image results grid reloads |
| Result volume | At least 5 `a.image-asset` elements visible in the DOM |
| First result href | Resolves to a `/details/…` URL; NASA ID extractable from path |
| Detail page — title | `<h1>` is visible on the detail route |
| Detail page — NASA ID | `NASA ID:` text node visible and matches the ID from the search result |
| Preview image validity | Asset URL from the "Copy asset URL" field fetched via HTTP; asserts 200 OK and `image/*` Content-Type |

### B — API (api.spec.ts)

| Test | Validates |
|---|---|
| Search — happy path | HTTP 200; `Content-Type: application/json`; full schema (`version`, `href`, `items`, `metadata.total_hits`); ≥ 1 item; non-empty `title` and `nasa_id` on first item |
| Asset details | HTTP 200; valid schema; ≥ 1 item in `collection.items`; each `href` is an absolute URL |
| Negative — nonsense query | HTTP 200; `items: []`; `total_hits: 0` |
| Negative — empty `q` | HTTP 200; NASA browse semantics (non-empty items, positive `total_hits`) — documented in spec comment |

### C — Integration (integration.spec.ts)

| Step | Assertion |
|---|---|
| API first result | Extracts `nasa_id` and `title` from `GET /search` |
| UI search by title | Result card with matching `nasa_id` in `href` is visible |
| Detail page open | Navigates directly via `href`; `/details/` route confirmed |
| Title consistency | `normalizeText(uiTitle) === normalizeText(apiTitle)` (whitespace + case) |
| NASA ID consistency | `uiNasaId` contains `nasaId`; page URL contains `encodeURIComponent(nasaId)` |

### Cross-cutting

- **Browsers:** Chromium, Firefox, WebKit (three projects in `playwright.config.ts`)
- **Stability:** No `waitForTimeout`; all waits via `expect()` with explicit timeouts
- **Debuggability:** `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`
- **Parallelism:** `fullyParallel: true`; tests share no mutable state
- **CI safety:** `retries: 1`, `workers: 2` under `CI=true`

---

## What Is NOT Covered (and Why)

| Gap | Reason not covered |
|---|---|
| Pagination (page 2, 3 …) | Assessment asks for first-page coverage; multi-page adds volume without new assertion types |
| Asset download actions (every size variant) | Detail page exposes multiple sizes; verifying the URL resolves is sufficient per assessment scope |
| Empty search on the SPA (client-side validation) | NASA's Angular app submits an empty query normally (no client-side block); not a meaningful test boundary here |
| Video and audio media types | Assessment allows choosing one media type; image was selected and kept consistent across all three tasks |
| Performance / load testing | Out of scope for a functional Playwright assessment |
| Authenticated or user-account flows | NASA Image Library has no login wall |
| Full negative UI coverage (e.g. 404 detail pages) | API negative tests cover the error surface; the UI does not expose a distinct error state for unknown IDs in a reliably testable way |
| Accessibility audits (axe / ARIA checks) | Outside the assessment rubric |

---

## Normalization Note (Integration Test)

The UI title is stripped of the suffix `| NASA Image and Video Library` (added by the page `<title>`) and both strings are lowercased with whitespace collapsed before comparison. This is the "light normalization" the assessment explicitly permits. The approach is documented in `integration.spec.ts` via the `normalizeText` helper.

---

## Risk & Mitigation Summary

The biggest stability risk is that this suite tests a live third-party website. NASA's Angular SPA has known issues with synthetic Playwright clicks and lazy-loading. All mitigations are documented in the README's flakiness table and implemented directly in `SearchPage.ts` and `playwright.config.ts`.
