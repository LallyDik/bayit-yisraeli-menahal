# E2E tests (Playwright)

Browser end-to-end tests that drive the real app in Chromium against the
**existing** Supabase project, using an isolated test user (no dedicated branch,
no service-role key, no cost).

## One-time setup

1. Copy `.env.e2e.example` → `.env.e2e` (gitignored) and fill:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same values as `.env.local` (the existing project's URL and anon key).
   - `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — a **dedicated throwaway** test account (auto-created on the first run via anon sign-up). Use an address that is not a real user, e.g. `playwright-e2e-<random>@example.com`.
2. `npx playwright install chromium` (already done on this machine). If a network
   filter blocks the Playwright CDN, either allowlist `cdn.playwright.dev` **and**
   `storage.googleapis.com`, or set `channel: 'chrome'` in `playwright.config.ts`'s
   top-level `use` to run the system-installed Chrome with no download.

## Running

```bash
npm run test:e2e         # headless, full suite
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # headed browser
npm run test:e2e:report  # open the last HTML report
```

## How it works

- `vite --mode e2e` serves the app on `http://localhost:8080` reading `.env.e2e`,
  so the app talks to the Supabase project under test.
- The `setup` project (`e2e/auth.setup.ts`) signs the test user in once (creating
  it on first run, exactly like `tests/helpers/auth.ts`), marks onboarding complete,
  and saves `e2e/.auth/user.json`; the spec projects reuse it and start signed in.
- `e2e/support/supabase-test-user.ts` (the test user's own **anon** client, no
  service-role) creates the user and resets **only its own** rows (RLS + an explicit
  `owner_id` filter) before each mutating test — a clean, isolated baseline that
  never touches other users' data.
- `auth.spec.ts` runs signed-out (empty `storageState`) to exercise the real
  login/logout UI.
- Single worker, `fullyParallel: false`, for determinism against the shared project.

## Coverage

- `auth.spec.ts` — landing page, login, logout
- `units.spec.ts` — empty state, add, edit, archive, search
- `tenants.spec.ts` — add with unit assignment + payment method, archive
- `payments.spec.ts` — mark rent paid (label per payment method), partial payment

## Not covered yet (future)

- CI workflow (GitHub Actions) — single-worker structure is CI-ready; needs a
  workflow + secrets, and either a Playwright-CDN allowlist or the `channel: 'chrome'`
  fallback on the runner.
- The tenant payment summary dialog from the overview; utility/meter charges.
- Password reset, notification settings, legal pages; other browsers / mobile viewports.
