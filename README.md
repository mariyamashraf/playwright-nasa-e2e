# Playwright NASA E2E Tests

- **Node.js** ≥ 18 (LTS recommended)
- **TypeScript** 5.x
- **Playwright Test** 1.40+
- Browsers: Chromium, Firefox, WebKit (installed via `playwright install`)

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 18 LTS | `node -v` |
| npm | 9 | `npm -v` |

---

## Installation

```bash
# 1. Install Node dependencies
npm install

# 2. Install Playwright browsers (Chromium, Firefox, WebKit)
npx playwright install

# 3. (Optional) Install OS-level browser dependencies on Linux/CI
npx playwright install-deps
```

---

## Running Tests

### All tests (all browsers)
```bash
npm test
# or
npx playwright test
```

### UI tests only
```bash
npm run test:ui
# or
npx playwright test tests/ui.spec.ts
```

### API tests only
```bash
npm run test:api
# or
npx playwright test tests/api.spec.ts
```

### Integration tests only
```bash
npm run test:integration
# or
npx playwright test tests/integration.spec.ts
```

### Single browser (faster during development)
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run with visible browser (headed mode)
```bash
npx playwright test --headed
```

### Debug a specific test interactively
```bash
npx playwright test tests/ui.spec.ts --debug
```

---

## HTML Report

The Playwright HTML reporter is enabled by default. After any test run:

```bash
npm run report
# or
npx playwright show-report
```

This opens a local server (default: http://localhost:9323) with the full interactive report
including traces, screenshots, and video for any failed test.

> **Pre-generated report:** A `playwright-report/` folder is included in the repo with a
> recent run output. Open `playwright-report/index.html` directly in your browser, or run
> `npm run report` to serve it properly.

---

## Project Structure

```
playwright-nasa-assessment/
├── pages/
│   └── SearchPage.ts          # Page Object for NASA Image Library UI
├── tests/
│   ├── ui.spec.ts             # Task A — UI search & validate media result
│   ├── api.spec.ts            # Task B — API search, asset details, negative tests
│   └── integration.spec.ts    # Task C — API-to-UI consistency
├── utils/
│   └── apiHelper.ts           # API helper: base URL, typed responses, shape assertions
├── playwright.config.ts       # Playwright config (browsers, timeouts, reporters)
├── package.json
├── README.md
└── TEST_PLAN.md               # Short test plan document
```

---

## Environment & CI Notes

- `workers` is capped at 2 on CI (`CI=true`) to avoid hammering live NASA endpoints.
- `retries: 1` is set on CI to handle transient network flakiness.
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`
  are all enabled so every failure is fully diagnosable.

---

## Pushing to GitHub (from scratch)

```bash
# From inside the project folder:

# 1. Initialise git (skip if already a git repo)
git init

# 2. Create a .gitignore
cat > .gitignore <<'EOF'
node_modules/
playwright-report/
test-results/
.DS_Store
EOF

# 3. Stage everything
git add .

# 4. Initial commit
git commit -m "feat: initial Playwright NASA assessment"

# 5. Create a new repo on GitHub (via browser or gh CLI), then link the remote:
git remote add origin https://github.com/<your-username>/playwright-nasa-assessment.git

# 6. Push
git branch -M main
git push -u origin main
```

Using the **GitHub CLI** (simpler — installs from https://cli.github.com):
```bash
gh repo create playwright-nasa-assessment --public --source=. --remote=origin --push
```

---

## Notes on Flaky Behavior & Mitigations

| Observed behaviour | Mitigation |
|---|---|
| Angular SPA route changes don't fire the `load` event reliably | `waitUntil: 'domcontentloaded'` everywhere; explicit `expect(page).toHaveURL()` guards after navigation |
| Firefox often stays on `/` after clicking the Submit button | Fallback `.press('Enter')` when URL doesn't change within 8 s |
| Lazy-loaded `<img>` pixels are unreliable in headless mode | Preview image verified by reading asset URL from the DOM clipboard field, then fetching it and asserting HTTP 200 + `image/*` Content-Type |
| Angular router ignores Playwright's synthetic `.click()` on `<a>` elements | Extract `href` via `getAttribute` and call `page.goto()` directly — bypasses the router issue entirely |
| Live NASA API can return slightly different page-1 ordering between calls | Integration test navigates directly by `nasa_id`-encoded URL; title comparison uses whitespace/case normalization |
| CI network latency causes intermittent timeouts | `retries: 1` on CI; all assertion timeouts ≥ 15 s; `workers: 2` on CI to avoid overloading the live endpoints |

---

## Test Plan

See [TEST_PLAN.md](./TEST_PLAN.md) for full coverage scope, gaps, and rationale.
