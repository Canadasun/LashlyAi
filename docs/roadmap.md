# LashlyAI Roadmap

See `CLAUDE.md` §6 for the full phase-by-phase build plan. This file tracks
actual progress and dates as phases complete — update it at the end of each
phase.

## Infrastructure: backend deployed on Railway

Live at https://lashlyai-production.up.railway.app (project `vigilant-acceptance`,
service `LashlyAi`), with a Railway-managed Postgres database, all 4 migrations
applied. Config lives in `.railway/railway.ts` (Railway's infra-as-code format —
see `.agents/skills/railway-config/SKILL.md` for how to edit it safely).

This is running in **staging mode** (`NODE_ENV=staging`), so it still uses the same
dev-auth bypass and mock AI responses as local dev — no real Firebase/OpenAI/Apple
credentials are set yet. **Not safe for real users in this state.** Also note:
image uploads go to the container's local disk, which Railway does not persist across
redeploys — move to real S3 storage before this handles real client photos.

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
Status: partially complete — everything buildable without an Apple Developer account is
done; the account-gated items (which is most of this phase's checklist) are blocked on
owner action.
Started: 2026-07-09

Done:
- App icon: brand-colored (`#D98FAF` background, `#F7E8E3` "L" mark) PNGs generated at
  every required iOS `AppIcon.appiconset` size and Android mipmap density, wired into
  `Contents.json`. It's a placeholder mark, not a final designed logo — swap the source
  in `mobile` before shipping if a proper logo gets designed.
- Privacy Policy and Terms of Service drafts in `docs/legal/` — cover client-photo
  consent responsibility, OpenAI/Firebase/Apple third-party data sharing, and
  subscription terms. **These are drafts and explicitly flagged as needing legal review
  before publishing** — every `[PLACEHOLDER]` (contact email, legal entity name,
  governing law) needs to be filled in too.
- StoreKit subscription backend: `POST /subscriptions/verify` implements Apple's real
  `verifyReceipt` flow (production → sandbox fallback per Apple's documented status
  21007 behavior), verified end-to-end against Apple's actual servers with a fake
  receipt (got back a real "malformed receipt" status, confirming the network path and
  error handling both work). Falls back to a dev-mode endpoint (pass `{"plan": "pro"}`
  directly) since no real subscription products exist yet in App Store Connect.
- Mobile paywall screen (Free/Pro plan cards) wired to the dev-mode endpoint. **Not
  wired to a real StoreKit purchase library** — same reasoning as the Crashlytics
  decision in Phase 2: no real App Store Connect products exist to purchase yet, and
  there's no iOS Simulator here to verify a native IAP module's startup behavior before
  shipping it.

Blocked on owner action — this is most of the phase's actual checklist:
- **Apple Developer Program account** ($99/yr) — needs the owner's own Apple ID and
  payment; can't be created by an agent.
- **App Store Connect listing** — needs the Developer account first, plus a real bundle
  identifier (the Xcode project currently still has the React Native template's default
  `org.reactjs.native.example.LashlyAIMobile` — pick and register a real one, e.g.
  `com.lashlyai.app`, once the Developer account exists).
- **Real screenshots** — need an actual running build on a device or the iOS Simulator,
  neither of which is available in this environment yet.
- **Real StoreKit subscription products** — created in App Store Connect once it
  exists; then update the placeholder product-ID → plan mapping in
  `backend/src/services/appleReceipt.service.ts`, set `APPLE_SHARED_SECRET`, and add a
  real IAP purchase library (e.g. `react-native-iap`) to the mobile paywall.
- **Submission for review** — needs everything above plus an uploaded TestFlight build
  (see Phase 2's blocker).

## Phase 4 — Production Launch
Status: partially complete — the pieces that don't depend on App Store approval are
done; a real "production launch" is blocked on Phase 2/3 completing first.
Started: 2026-07-09

**Reality check on this phase's own checklist**: "AI lash mapping, client profiles,
save designs — live" describes a real v1.0 launch, which requires the mobile app to
actually be through TestFlight and App Store review (Phase 2/3's blockers — paid Apple
Developer account, full Xcode.app, real screenshots, submission). None of that has
happened yet, so there is no real production launch to report here. What follows is
what could be built independently of that.

Done:
- **Admin dashboard** — `GET /admin` (HTML) and `GET /admin/stats` (JSON), protected by
  HTTP Basic Auth against a dedicated `ADMIN_API_KEY` (not tied to any user account —
  there is no `503` fallback like other dev-mode bypasses in this repo; admin data is
  never reachable without a key configured). Shows total users + recent signups, client
  profile/lash map counts, subscriptions by plan, a count of "unverified" (mock) AI
  outputs, and recent feedback submissions. Verified locally end-to-end.
- **Monitoring/alerting** — owner chose to rely on Railway's own observability
  (`railway status`, `railway logs`, `railway metrics`) rather than a new external
  uptime-monitoring account. Note: Railway does support email/Slack notifications on
  deploy failure, but that's a per-account dashboard setting (Project Settings →
  Notifications), not something scriptable via the CLI — worth 2 minutes to turn on
  manually if you want push alerts instead of checking in manually.

Not done / blocked:
- A real production launch (the actual point of this phase) — see Phase 2/3.

## Phase 5 — Enterprise Expansion
Status: in progress, against the brief's own explicit instruction ("build only after
Phase 4 is stable in production") — owner explicitly chose to proceed anyway for
groundwork. Real production isn't live yet; see Phase 2/3/4 blockers.
Started: 2026-07-09

Order chosen: AI photo feedback first, since it most directly extends existing
infrastructure (photo upload + AI service pattern) and drives upsell/retention for
users who already exist, versus the platform-scale items (education, marketplace,
community) which need a real user base to justify their much larger scope.

Done:
- **AI photo feedback** — scores a photo of the artist's *completed* lash work (not
  the pre-work client eye photo used for lash mapping) on isolation, direction, and
  styling, 0-100 each plus an overall judgment. `POST /clients/:id/photo-feedback` +
  `GET /clients/:id/photo-feedback`, a `photo_feedback` Postgres table, mock fallback
  matching the rest of this codebase's AI services, and a mobile "Score My Work"
  screen off the client profile. Scoring rubric documented in `docs/lash-rules.md` §7
  (same placeholder-pending-owner-review status as the lash-mapping tables). Verified
  end-to-end via curl and the mobile call path.

Not started: client before/after timeline + retention reminders, education platform,
educator platform, salon team management, inventory management, marketing AI,
marketplace, community, GDPR/PIPEDA compliance pass.
