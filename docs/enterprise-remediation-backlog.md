# Enterprise remediation backlog

This backlog parks the findings from the 2026-07-10 production-readiness audit. Work is
ordered by release risk and implementation weight. An item is only complete after code,
tests, deployment, and production verification are all finished.

## P0 — release blockers

- [x] Private, durable client-photo storage, authenticated delivery, and complete deletion
  - Production verified on 2026-07-10: Railway object storage, tenant-owned media records,
    decoded/normalized uploads, authenticated delivery, client deletion, and account deletion.
- [ ] **App Store Connect submission metadata — nothing configured yet.** See 2026-07-15
  audit below: no subscription products, no age rating, no privacy policy URL, no
  screenshots, no description/keywords/support+marketing URLs, no territory availability.
  The app has never been submitted (version 1.0 sits in `PREPARE_FOR_SUBMISSION`).
- [ ] Production StoreKit purchase flow and entitlement verification — code path exists
  (`PaywallScreen.tsx` + `appleReceipt.service.ts`) but the products it references
  (`lashlyai_pro_monthly`, `lashlyai_pro_yearly`) don't exist in App Store Connect yet, so
  no purchase can ever succeed until they're created.
- [ ] Accurate iOS privacy manifest, reviewed legal documents, consent, export, and account
  deletion — `docs/legal/privacy-policy.md` and `terms-of-service.md` are drafted but not
  hosted at a public URL, so they can't be entered into App Store Connect yet.
- [x] Hardened authentication: ~~secure device storage~~ (done 2026-07-14), ~~admin
  identities, audit trail~~ (done 2026-07-15 — full Joiner/Mover/Leaver lifecycle
  logging, see `user_lifecycle_events`), ~~Sign in with Apple~~ (done 2026-07-15).
  **Still open:** password reset, email verification, session revocation, MFA.
- [ ] Billing-grade transactional quotas and rate limits for every AI/cost-bearing endpoint

## P1 — correctness and deployment safety

- [ ] Backend integration test suite for authentication, ownership, subscriptions, quotas,
  uploads, migrations, and deletion
- [ ] Schema-based request validation, input limits, pagination, and consistent 4xx errors
- [ ] Single-owner migrations with advisory locking and deployment-aware health verification
- [ ] Readiness checks, graceful shutdown, connection-pool limits, restore drills, and alerting
- [ ] Fix nullable inventory updates and add database constraints for non-negative values
- [ ] Replace community email exposure with public profiles and add moderation controls

## P2 — mobile and operational quality

- [ ] Raise mobile workflow coverage from 16% to an enforced release threshold
- [ ] Replace stale product copy and documentation; remove contradictory Firebase/dev claims
- [ ] Correct iOS metadata and remove unused permissions
- [ ] Configure Android release signing, Crashlytics, and CI native builds
- [ ] Resolve mobile dependency advisories
- [ ] Establish staging/prod separation, branch protection, release approvals, and rollback runbooks

## 2026-07-14 audit — bugs found and fixed

- [x] Dashboard partial-failure masking: `HomeDashboardScreen.tsx` used
  `Promise.allSettled` across `/clients`, `/users/me/usage`, `/inventory` but only
  surfaced an error banner if *all three* failed. A single failed `/inventory` call
  (e.g. a transient 500) silently rendered "0 items need action" — a false-healthy
  signal on the stock-attention metric. Fixed: each card now shows "Unable to load"
  instead of a fake zero when its own request failed.
- [x] Standalone "Glue Guide" tool (`GET/POST /tools/glue-recommendation`,
  `GlueRecommendationScreen`) removed — it had zero plan/quota gating despite
  `docs/api-spec.md` calling it "Pro tier" (a monetization/doc-vs-code mismatch that no
  longer applies since the route is gone). `recommendGlue()` itself is retained as an
  internal helper — it's still a dependency of `troubleshootRetention()`'s AI context.
  Replaced with a "Photo Editor" quick action on the Dashboard and Client List (the
  `PhotoEditorScreen`/`POST /clients/:id/photo-edit` feature already existed fully
  built, just reachable only from inside an individual client's profile — it wasn't a
  new feature to build, just newly surfaced with proper entry points).
- [x] Client directory (`ClientListScreen.tsx`) had no search — added `?q=` on
  `GET /clients` (server-side `name ILIKE`) with a debounced search box.
- [x] Client directory had a duplicate header: its own custom brand/sign-out row was
  rendered underneath the native stack header ("Clients"), unlike every other custom
  screen (e.g. the Dashboard) which disables the native header. Fixed by setting
  `headerShown: false` for the `ClientList` route.
- [x] Client directory rows and empty/error states used hardcoded hex colors
  (`'#ffffff'`, `'#B3261E'`) instead of the shared `colors.surface`/`colors.danger`
  tokens already used on the Dashboard — reconciled onto the same token set, plus added
  photo-thumbnail (or letter-initial fallback) avatars per row, matching the pattern
  already used on the Dashboard's recent-clients list.
- [x] **Photo Editor had no AI retouch capability** — only local Skia color filters
  (brightness/contrast/saturation/presets), despite being positioned as an important,
  AI-forward feature of the app. Added a real AI retouch (skin-smoothing/blemish
  reduction via `gpt-image-1` `images.edit`, `retouchPhoto()` in `ai.service.ts`,
  mirroring the existing `generateLashPreview` pattern exactly): its own DB migration
  (`0021_photo_retouch.sql`), media purpose, usage-event type, monthly quota
  (`checkPhotoRetouchQuota`, free: 0 / paid: unlimited), route
  (`POST /clients/:id/photo-retouch`, consent-gated), and a mobile "AI Retouch" card
  with its own consent checkbox at the top of `PhotoEditorScreen`. Verified end-to-end
  against the real (not mocked) OpenAI API in this dev environment: registered a test
  user, hit the route with and without consent, confirmed the free-tier 403 quota block
  fires *before* the OpenAI call (so denials don't cost anything), and visually
  confirmed the returned image was a genuine photorealistic retouch result, not a
  passthrough or error. Migration applied and verified against the local Postgres
  schema (`media_assets_purpose_check` / `usage_events_event_type_check` constraints
  confirmed via `pg_get_constraintdef`). Test data cleaned up after verification.

## 2026-07-14 audit — cryptography and session handling (same day, third session)

- [x] **Session tokens were persisted in plain AsyncStorage** — unencrypted on-disk
  storage (a plist/SQLite-backed file inside the app sandbox, readable on a
  jailbroken/rooted device or from an unencrypted device backup), for a 30-day bearer
  credential. Migrated to `react-native-keychain` (`ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY`
  — OS Keychain-backed, never synced to iCloud, unreadable before first unlock, no
  biometric prompt on every read since that would fight session persistence rather than
  just secure it). `authService.ts` migrates any pre-upgrade session out of the legacy
  AsyncStorage key into Keychain on first read after the upgrade, so existing installs
  (e.g. current TestFlight testers) aren't silently signed out. Covered by new tests
  (round-trip via Keychain, corrupted-Keychain handling, legacy-migration path) — mobile
  suite went from 19 to 21 tests, all passing.
- [x] **Server-side password/session cryptography re-verified, no issues found**:
  `scryptSync` with a random 16-byte salt + `timingSafeEqual` comparison for passwords;
  HMAC-SHA256-signed session tokens with `timingSafeEqual` verification, explicit `exp`
  checking, and the fail-closed dev-secret fallback (only `development`/`test`/unset
  `NODE_ENV`) from the 2026-07-10 IAM audit still in place. Repo-wide sweep for
  MD5/SHA1/`Math.random()`-for-security/hardcoded secrets in source — none found.
  `.env` confirmed gitignored.
- [x] **Real UX/security bug**: tapping the profile-letter avatar on the Dashboard (and
  the "Sign out" link on the Client List) signed the user out **instantly**, with zero
  confirmation — a single mis-tap loses the current session. Both now show a
  confirm/cancel dialog before signing out.
- [x] **Confirmed, not changed**: no push-notification code exists anywhere in the repo
  (no `@react-native-firebase/messaging`, no `PushNotificationIOS`, nothing) — CLAUDE.md
  lists Firebase Cloud Messaging as a planned-but-unbuilt tech choice, not something
  live. No streak/gamification/login-bonus/manufactured-urgency code found in a
  repo-wide sweep. `CompSubscriptionBanner.tsx` (the one existing "notification" UI) was
  reviewed and is a one-time, dismissible, factual notice about an admin-granted comp
  subscription — not a manipulative retention pattern.

## 2026-07-14 audit — still open (confirmed, not addressed this pass)

- [ ] **No pagination on `GET /clients`.** Search narrows results but the endpoint still
  has no `LIMIT`/`OFFSET` — an artist with a very large client book still fetches every
  row on every screen focus. Same gap applies to `/clients/:id/lash-maps`,
  `/clients/:id/photo-feedback`, `/inventory`, `/forum/posts` (tracked under the
  existing P1 "pagination" item above).
- [ ] **RBAC confirmed unused.** `User.role` (`salon_owner`/`academy`) and
  `Subscription.plan` (`salon`/`enterprise`) exist as enum values only — no route reads
  `role` for authorization anywhere; admin access is a separate `is_admin` boolean.
  Building real team/multi-user support behind these is a Phase 5 decision, not a bug.
- [x] **No audit logging** — resolved 2026-07-15 via the JML (Joiner/Mover/Leaver)
  lifecycle system: `user_lifecycle_events` table + `GET /admin/lifecycle-events`, logging
  signup, plan changes, admin grants/revocations, admin status changes, and account
  deletion. Bulk operations and CSV export are still not built.

## 2026-07-15 audit — App Store Connect submission readiness

Queried the App Store Connect API directly against the live `com.canadasun.lashlyai` app
record (id `6789339271`) rather than assuming from local files. Findings, in order of how
hard they block submission:

- [ ] **No subscription products exist.** `subscriptionGroups` and `inAppPurchasesV2` are
  both empty — `lashlyai_pro_monthly`/`lashlyai_pro_yearly` (referenced in
  `PaywallScreen.tsx` and `appleReceipt.service.ts`) have to be created in App Store
  Connect (name, price tier, subscription group, localized display text, review
  screenshot) before any purchase can work, sandbox or production.
- [ ] **No age rating.** `appStoreAgeRating` is `null` — the age rating questionnaire has
  never been completed; App Store Connect won't allow submission without it.
- [ ] **No primary category set** — `appInfos`' `primaryCategory` relationship is empty
  (e.g. Business, Lifestyle, or Health & Fitness would all be defensible for this app;
  needs an owner decision, not a guess).
- [ ] **No privacy policy URL on file.** `privacyPolicyUrl` is `null` on the app info
  record. `docs/legal/privacy-policy.md` and `terms-of-service.md` are already drafted in
  this repo but need to be hosted at a real, public URL and that URL entered in ASC —
  Apple requires a live link, not just a document.
- [ ] **Version 1.0's localization is entirely empty.** No description, keywords, support
  URL, marketing URL, promotional text, or "what's new" text for the `en-US` localization.
- [ ] **Zero App Store screenshots** for any device size — a hard submission blocker.
- [ ] **No territory availability configured** (`appAvailabilityV2` 404s) and **no price
  schedule** (`manualPrices` is empty) — the app isn't set to be sold anywhere yet.
- [ ] **No content rights declaration** (`contentRightsDeclaration` is `null`) — a required
  yes/no answer about third-party content.
- [ ] **App name is "LashlyAi"** (lowercase second "i") in both the bundle record and the
  `en-US` localization — worth a deliberate decision (matches brand exactly, or should be
  "LashlyAI") before submission, not left as a typo.
- [x] **Unused, empty location permission removed.** `Info.plist` had
  `NSLocationWhenInUseUsageDescription` set to an empty string with no location code
  anywhere in the app — Apple review flags empty usage-description strings, and an unused
  permission invites a rejection for asking for access the app doesn't use. Removed the key
  entirely rather than filling in a description for a feature that doesn't exist.
- Confirmed **not** a blocker: Sign In with Apple is optional here (the app has no
  Google/Facebook login, so Apple's "must offer Sign In with Apple if you offer other
  social logins" rule never applied) — built anyway as a real feature (see above), not to
  clear a review requirement.
- Confirmed **not** a blocker: app icon set is complete (all 13 required sizes present,
  `Contents.json` has no missing filenames).
- Confirmed **not** a blocker (this pass): latest build (37) already clears the two
  automatic TestFlight gates — export compliance declared (`usesNonExemptEncryption:
  false`) and `processingState: VALID`.
