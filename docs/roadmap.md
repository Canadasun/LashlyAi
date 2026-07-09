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
Status: not started

## Phase 2 — Internal Testing
Status: not started

## Phase 3 — App Store Preparation
Status: not started

## Phase 4 — Production Launch
Status: not started

## Phase 5 — Enterprise Expansion
Status: not started
