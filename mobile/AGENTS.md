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
- Only use libraries Expo Go already includes, so every stage previews in Expo Go.
- Keep everything up to date: newest packages the Expo SDK supports (`npx expo install --check`), latest GitHub Actions, newest stable Xcode.
- Arabic, right-to-left, digits 0-9 only. Backups stay on the device; no iCloud until the Apple Developer step L2.
- End of every phase: re-check the whole phase against `docs/EXPO_PLAN.md` and real use (what the owner will need to test it), and fix or add anything missed or wrong before handing it over, without waiting to be asked. List the findings in the pull request.
- One pull request per phase, kept as a draft while steps are pushed (only the fast checks run). Mark it ready for review when the phase is complete: the `.ipa` build then runs on every push. Publish the Expo Go preview each phase (`eas update --branch preview`); the owner tests it and the `.ipa`. The simulator tests (`mobile-simulator.yml`) run only at the end of the project or for a critical change (security and PINs, saving data, backups), and only after telling the owner why.
