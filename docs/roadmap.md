# LashlyAI Roadmap

See `CLAUDE.md` §6 for the full phase-by-phase build plan. This file tracks
actual progress and dates as phases complete — update it at the end of each
phase.

## Phase 0 — Scaffolding
Status: complete
Started: 2026-07-09
Completed: 2026-07-09

## Phase 1 — Core MVP
Status: complete (backend fully verified end-to-end; mobile verified via tsc/lint/tests,
not yet run on an iOS Simulator — see caveat below)
Started: 2026-07-09
Completed: 2026-07-09

Built against dev-mode stubs, by design (owner chose these to avoid cost/setup before
committing to real accounts):
- Firebase project not yet created — auth uses a DEV AUTH BYPASS (`Bearer dev:<email>`)
  on the backend, and the mobile app mints matching `dev:<email>` tokens when no
  Firebase config is present in `mobile/.env`. Swap in real Firebase config on both
  sides to go live.
- OPENAI_API_KEY not yet set — eye-analysis and the AI Lash Coach return clearly-labeled
  mock responses. Add a real key to `backend/.env` to make real OpenAI calls (this costs
  money per request).
- Image storage uses the local-disk stub (`backend/local-storage/`), not S3.

Known gap: this dev machine has Command Line Tools but not full Xcode.app, so the iOS
Simulator isn't available. The mobile app type-checks cleanly, passes its test suite, and
lints clean, but hasn't been visually run end-to-end on a simulator/device. The backend's
full loop (register → create client → upload photo → mock eye-analysis → generate
deterministic lash map → save → view client with history → coach Q&A → ownership checks)
was verified live via curl.

## Phase 2 — Internal Testing
Status: partially complete — everything buildable without an Apple Developer account is
done; the TestFlight build/upload itself is blocked pending owner action (see below).
Started: 2026-07-09

Done:
- Crash/error logging: mobile has a console-based crash reporter + global JS error
  handler (`ErrorUtils.setGlobalHandler`) + a React `ErrorBoundary` wrapping the app,
  all behind a swappable `CrashReporter` interface. Backend has structured request
  logging, a centralized Express error-handling middleware, and `asyncHandler` wrapping
  on every route (this also fixed a real latent bug: async route errors used to hang
  requests forever instead of returning a 500 — verified fixed via curl).
- Feedback intake: `POST /feedback` + a `feedback` Postgres table + a mobile
  "Report an Issue" screen reachable from the client list header.
- AI accuracy tracking: the mechanism already exists from Phase 0 — every AI response
  carries a `mock` flag, and `docs/lash-rules.md` §7 has an Owner Review Log table ready
  for logging corrections once real client sessions happen. This is inherently a manual
  process the owner runs once using the app with real clients, not something to build.

Blocked on owner action — needs to happen before this phase can finish:
- **TestFlight build requires a paid Apple Developer Program account ($99/yr)** and the
  **full Xcode.app** (this dev machine only has Command Line Tools). Neither can be set
  up by an agent — the Developer account needs the owner's Apple ID + payment, and
  Xcode is a multi-GB interactive App Store install. Once both exist, the actual
  archive/upload step is mostly a GUI flow in Xcode (or `xcodebuild` + `altool`/
  Transporter from the CLI) that should be run and watched directly rather than
  scripted blind, since code-signing failures are easy to introduce and hard to
  diagnose from logs alone.
- **Activating real Crashlytics**: once a real Firebase project exists (from the Phase 1
  auth work) with a `GoogleService-Info.plist` (iOS) / `google-services.json` (Android)
  in place, add `@react-native-firebase/app` + `@react-native-firebase/crashlytics`,
  wire a Crashlytics-backed `CrashReporter` implementation into
  `mobile/src/services/crashReporting.ts`, and re-run `pod install`. This was
  deliberately not done yet — those native SDKs auto-configure at launch and will
  hard-crash the app if the config file is missing, and this environment has no iOS
  Simulator to verify that startup path works before shipping the change.

## Phase 3 — App Store Preparation
Status: not started

## Phase 4 — Production Launch
Status: not started

## Phase 5 — Enterprise Expansion
Status: not started
