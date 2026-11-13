This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## SALFORD POS project rules

- Plan: `../docs/EXPO_PLAN.md`. Follow it phase by phase.
- **After every step or task: test, check, and push to the open pull request.** Run `npm run check` (typecheck, lint, format, tests) and `npx expo-doctor` before each push. A step is done only when its checks pass and it is pushed.
- The owner merges every pull request. Never merge.
- Prefer libraries Expo Go already includes. Expo Go is no longer a hard rule (the owner tests with the `.ipa`): add a library with its own native code only when it is clearly better, and ask the owner first.
- The app works fully offline: no web addresses, no network calls. The only connection is the instant-update check when online, which must never make the app wait. Nothing may need the internet; check this in every phase's self-check.
- Instant updates (from Phase 8): publish to the `preview` branch for testing; publish to `production` (the installed app) only after the owner says OK, always with `npm run update:production -- "message" --approved` (never `eas update` directly): it refuses when the native side (fingerprint) or the database version differs from the installed `.ipa` recorded in `updates/installed-build.json`. After the owner installs a new `.ipa`, record it with `npm run update:record` on that commit (the `.ipa` job summary shows its fingerprint). Say whether each change can go as an update or needs a new `.ipa` (native changes).
- Live data (databases, photos) never goes in the folder the Files app shows (`Paths.document`): only Backups and Receipts belong there.
- Database upgrades (from Phase 8): save a copy of the database first; switch foreign keys off while rebuilding a table and run `PRAGMA foreign_key_check` after (never rebuild a table with foreign keys on: the cascades would delete linked rows); upgrade older backups in the same change and test restoring a backup from schema version 1. A schema change ships only in a new `.ipa`, never as an instant update.
- Backups and other important files are written under a temporary name and renamed when complete; never hold every photo (or a whole large table) in memory at once. A restore writes its safety copy to disk before replacing anything.
- Staff (phases S1 to S6 in the plan): every action that changes data checks a named permission as its first line, inside the business rules (not only in the screen), and knows who does it; deny by default and fail closed; owner-only screens are guarded as a whole; every such action writes its activity-log line in the same transaction; policies (return window, discount limits, lock times, return conditions) are owner settings, never constants; staff are suspended, never deleted. Add every new action to the permission test matrix (`src/staff/permissions.test.ts`, which fails on an action without `allow(ctx, '…')` as its first line or missing from the matrix). New permissions go in `src/staff/permissions.ts` (`EMPLOYEE_MAY` starts at `false`). Owner screens are wrapped in `<Allowed permission>`; buttons and figures use `useCan`. Queries of sales and receipts filter with `visibleTo`, so an employee only ever reads their own. Every checked action calls `logAction(ctx, '<area>.<verb>', '<Arabic summary>')` inside its transaction, after its changes; never update or delete `activity` rows. Changes are refused while the device clock is behind (`allow` asks `ctx.clock`); reading uses `allowView`, which never asks the clock. Going past an employee rule (discount limits, return window, a condition) needs `ownerSays(ctx, purpose, token)`: the owner signed in, or a one-time token from the owner's approval on the spot; the limits live in `src/domain/policies.ts`, never as constants. An employee's sale, return or debt payment needs an open shift: get its id with `shiftFor(ctx, actor)` (`src/domain/shifts.ts`, null for the owner without one) and store it in `shift_id`; in tests, `makeCtx` opens one when the actor is an employee (`autoShift`). The stock count (`src/domain/stock-count.ts`) is blind: nothing an employee can open may show a piece's stock during a count; the owner's alerts (`src/domain/alerts.ts`) read existing records, with their limits in the policies.
- Every screen has an error boundary (retry screen) and errors are written to the on-device log; never let one bug close the app.
- Speed: `npm run speed` (2,000 products, 10,000 and 30,000 sales) must stay under its targets; run it after changing a query a screen uses.
- Long lists load as you scroll; never load every sale or receipt (or their lines) at once, and never load a whole table just to list its months.
- Keep everything up to date: newest packages the Expo SDK supports (`npx expo install --check`), latest GitHub Actions, newest stable Xcode.
- Arabic, right-to-left, digits 0-9 only. Backups stay on the device; no iCloud until Phase 11 (Apple Developer account, step 11.4).
- The app's only native code is two local modules: `modules/backup-exclusion` (excludes the app's folders from the device's iCloud backup) and `modules/key-commands` (iPad keyboard shortcuts ⌘F / ⌘N, added with the owner's OK in Phase 9; screens use `useShortcut` / `useSearchShortcut` from `src/lib/key-commands.ts`). Each It is loaded with `requireOptionalNativeModule`, so Expo Go (which does not have it) keeps working. Add native code only when it is clearly better than what Expo Go includes and the owner agrees; while the Expo Go preview is still published, give it a fallback that works there.
- iPad widths: never centre a scroll view's content with `alignSelf: 'center'` / `maxWidth` on `contentContainerStyle`: in right-to-left it is ignored and the content sticks to the right. Use `useReadable()` (`src/hooks/use-readable.ts`), which measures the scroll view and pads both sides; `Screen` and `Page` already do. Check every new screen at iPad width (portrait and landscape) in the self-check.
- iPad layout by type of screen, using the whole width: a list opens its details beside it (as in the iPad Settings app); dashboards and grids use cards that fill the width; forms open as windows (sheets). A plain centred column is only for forms and single detail screens.
- Screens opened from a tab (e.g. Management → Sales) open inside that tab's stack, so the tab bar stays visible, as in Apple's apps.
- End of every phase: re-check the whole phase against `docs/EXPO_PLAN.md` and real use (what the owner will need to test it), and fix or add anything missed or wrong before handing it over, without waiting to be asked. List the findings in the pull request.
- In that self-check, review on purpose every native piece the jest tests replace with stand-ins (tab bar, link previews and menus, segmented control, swipe rows, sheets): tests cannot show how they lay out on a device. Prefer plain, proven components in list rows; a native link preview inside a swipeable row broke the row's layout on device in Phase 4. The native tab bar follows the device's direction, so it is forced to the app's right-to-left direction.
- One pull request per phase, kept as a draft while steps are pushed (only the fast checks run). Mark it ready for review when the phase is complete: the `.ipa` build then runs on every push. Publish the Expo Go preview each phase (`npm run update:preview -- "message"`, which sets `SALFORD_UPDATE_TARGET=expo-go` so the update fits Expo Go); the owner tests it and the `.ipa`. Do not start simulator runs (`mobile-simulator.yml`) during the build (owner's decision, 2026-11-12): the owner tests each phase on the devices. The simulator tap-through and screenshots, and a full test list of the whole app for the owner, are plan step 10.0, the last step before the Apple Developer steps. Write the Maestro flow for each new feature in its phase, ready for 10.0.
