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

- [x] **Subscription group + both products created 2026-07-15.** "LashlyAI Pro" group
  (id `22240701`) with `lashlyai_pro_monthly` ($9.99, id `6791351535`) and
  `lashlyai_pro_yearly` ($79.99, id `6791351410`), both with en-US localizations
  (name + the 55-char-max short description ASC requires) and USA pricing set to the
  exact price points. Matches the product IDs already hardcoded in `PaywallScreen.tsx`
  and `appleReceipt.service.ts`.
- [ ] **Pricing writes are blocked pending the Paid Applications Agreement.** Free
  metadata (group, products, localizations, category, age rating, content rights) all
  wrote successfully via the API; the price-write call (`POST /v1/subscriptionPrices`)
  consistently 409s with a generic `ENTITY_ERROR.RELATIONSHIP.INVALID` even though the
  price point resolves fine standalone via `GET`. This matches Apple's known behavior:
  monetary writes are gated behind an active Paid Applications Agreement (banking + tax
  info), which only the account holder can complete in ASC's "Agreements, Tax, and
  Banking" section — not exposed via API. **Action needed from the owner**: sign the
  Paid Applications Agreement and enter banking/tax info in App Store Connect. After
  that, either ask for the price to be set again via the API (price point IDs may need
  re-querying via each subscription's `pricePoints` endpoint, since they're not
  guaranteed stable), or just set $9.99/$79.99 manually in the portal — it's a two-field
  form once the agreement is active.
- [x] **Age rating declaration completed 2026-07-15** — answered accurately per the app's
  actual content: no violence/gambling/sexual content/drugs/mature themes,
  `userGeneratedContent: true` (see new finding below), everything else `false`/`NONE`.
- [x] **Primary category set to Business** (2026-07-15) — reasonable fit for a
  professional tool (client management, inventory, marketing) aimed at working lash
  artists; easy to change later in the portal if a different category is preferred.
- [x] **Content rights declaration set** (2026-07-15) — `DOES_NOT_USE_THIRD_PARTY_CONTENT`,
  accurate for this app.
- [ ] **New finding: the forum has zero content moderation.** Declaring
  `userGeneratedContent: true` (accurate — `ForumListScreen`/`ForumPostDetailScreen` let
  users post freely) surfaced a real App Review Guideline 1.2 gap:
  `backend/src/routes/forum.routes.ts` has no reporting, blocking, or moderation
  mechanism at all. Apple requires UGC apps to have a way to filter objectionable
  content, report/block abusive users, and let the developer act on reports — this needs
  to exist before submission, not just be declared honestly in the rating.
- [ ] **No privacy policy URL on file.** `privacyPolicyUrl` is `null` on the app info
  record. `docs/legal/privacy-policy.md` and `terms-of-service.md` are already drafted in
  this repo but need to be hosted at a real, public URL and that URL entered in ASC —
  Apple requires a live link, not just a document. Owner chose GitHub Pages for this
  (2026-07-15) — not yet set up.
- [ ] **Version 1.0's localization is entirely empty.** No description, keywords, support
  URL, marketing URL, promotional text, or "what's new" text for the `en-US` localization.
- [ ] **Zero App Store screenshots** for any device size — a hard submission blocker.
  Blocked on a working local build to screenshot from (see below).
- [ ] **No territory availability configured** (`appAvailabilityV2` 404s) — the app isn't
  set to be sold anywhere yet; likely blocked on the same Paid Applications Agreement as
  pricing above.
- [ ] **App name is "LashlyAi"** (lowercase second "i") in both the bundle record and the
  `en-US` localization — worth a deliberate decision (matches brand exactly, or should be
  "LashlyAI") before submission, not left as a typo.
- [x] **Restricted to iPhone-only for this submission** (2026-07-15, owner decision) —
  `TARGETED_DEVICE_FAMILY` changed from `"1,2"` to `"1"` in both Debug and Release app
  target configs. iPad support (and its own screenshot set) deferred to a later pass.
- [x] **Unused, empty location permission removed.** `Info.plist` had
  `NSLocationWhenInUseUsageDescription` set to an empty string with no location code
  anywhere in the app — Apple review flags empty usage-description strings, and an unused
  permission invites a rejection for asking for access the app doesn't use. Removed the key
  entirely rather than filling in a description for a feature that doesn't exist.
- [ ] **No local Simulator build works for this project.** `React-Core-prebuilt` (the
  pinned prebuilt React Native Core pod) is missing linker symbols for both arm64 and
  x86_64 Simulator slices — `Undefined symbols for architecture arm64`, e.g.
  `facebook::react::ShadowNode::getDebugName()`. This project has only ever been verified
  via real device archives (the `local_testflight_build.sh` path), never a local
  Simulator run — pre-existing, unrelated to any change this session. Blocks generating
  App Store screenshots locally until resolved (likely needs a non-prebuilt Core pod
  variant for Simulator, or screenshots sourced from a physical device instead).
- Confirmed **not** a blocker: Sign In with Apple is optional here (the app has no
  Google/Facebook login, so Apple's "must offer Sign In with Apple if you offer other
  social logins" rule never applied) — built anyway as a real feature (see above), not to
  clear a review requirement.
- Confirmed **not** a blocker: app icon set is complete (all 13 required sizes present,
  `Contents.json` has no missing filenames).
- Confirmed **not** a blocker (this pass): latest build (37) already clears the two
  automatic TestFlight gates — export compliance declared (`usesNonExemptEncryption:
  false`) and `processingState: VALID`.

## 2026-07-15 audit continuation — moderation, listing copy, hosting

- [x] **Local Simulator build investigated further, still unresolved.** Tried forcing a
  source build (`RCT_USE_PREBUILT_RNCORE=0`) instead of the prebuilt Core pod — different
  failure this time (`Redefinition of module 'react_runtime'` between `React-RuntimeHermes`
  and another still-prebuilt dependency, likely `ReactNativeDependencies`), persists even
  after a full `ModuleCache.noindex` wipe. Restored the original prebuilt config (matches
  the working device-archive pipeline) rather than leave the project in a broken
  intermediate state. This needs real toolchain investigation, not a quick flag flip —
  deprioritized; screenshots remain blocked on it.
- [x] **App Store listing copy set via API**: description, keywords
  (`lash artist,lash tech,eyelash,volume lash,client crm,ai beauty,salon tools,lash mapping`),
  promotional text, and app subtitle ("AI Lash Mapping for Artists"). `whatsNew` can't be
  set on a first version (Apple only allows it starting with the second submission).
- [ ] **supportUrl / marketingUrl still unset — blocked on hosting.** Tried GitHub Pages
  (free, would've used a `gh-pages` branch with only public-safe content, isolated from
  `/docs`'s internal audit notes) — Apple/GitHub's own API rejected it:
  `"Your current plan does not support GitHub Pages for this repository"` — the free tier
  only covers *public* repos, and `Canadasun/LashlyAi` is private. This is a genuine
  cloud-provider/cost decision (upgrade GitHub, use a different free static host like
  Netlify/Vercel/Cloudflare Pages, or make the repo public) — flagged to the owner rather
  than picked unilaterally, per this project's own working-agreement rule about cloud
  provider choices.
- [x] **Fixed factual inaccuracies in the still-unpublished privacy policy/ToS drafts**:
  removed the Firebase Authentication claim (auth is custom scrypt+HMAC, not Firebase —
  see `auth.service.ts`), corrected "planned" Firebase analytics/push (only Crashlytics is
  live), clarified storage is S3-compatible via Railway not literally AWS, and updated
  Sign in with Apple from "when enabled" to live. Filled the contact-email placeholders
  with `support@lashlyai.com`. **Deliberately did not publish or link these** — both docs
  are still self-labeled "REQUIRES LEGAL REVIEW BEFORE PUBLISHING" and have real unfilled
  placeholders (legal entity name, business address, governing law/jurisdiction) that only
  the owner/a lawyer should supply; publishing an unreviewed legal document as the official
  policy for a business handling client photos isn't something to do on autonomous
  momentum from a general "continue" instruction.
- [x] **New finding, fixed same-day: forum leaked raw author emails despite deriving a
  display name.** The first moderation commit computed `author_display_name` but spread
  `...row` first, which kept `author_email` (and an internal `hidden` flag) in every forum
  API response anyway. Caught by a live smoke test immediately after deploying — not by
  code review — fixed by explicit destructuring instead of an additive spread, redeployed,
  and re-verified live before moving on.

## 2026-07-16 — alerts and notifications (Twilio + email)

Built the notification layer requested alongside the original JML lifecycle ask
("alerts templates for twilio and emails"). `email.service.ts` (Resend HTTP API) and
`sms.service.ts` (Twilio HTTP API), both plain `fetch` with no new npm dependency, plus
`notificationTemplates.ts` holding every message's copy in one place. Both are
stub-safe — without credentials configured they log instead of sending, matching the
existing `storage.service.ts` pattern for AWS S3, rather than throwing or blocking the
action that triggered them.

Wired into every already-existing event that should notify someone: welcome email on
signup (register + Sign in with Apple), comp subscription grant/revoke email (mirrors
the existing in-app banner), subscription-expired email, admin email+SMS alert on a new
forum report, and a rate-limited (one per 15 minutes) admin SMS alert on an unhandled
500. Verified live: deployed, confirmed the server boots cleanly with both providers
unconfigured (warns, doesn't crash), registered and deleted a real test account, and
confirmed via Railway logs that the welcome-email stub actually fired for it.

- [ ] **Neither Resend nor Twilio credentials exist yet.** Both are genuinely optional,
  paid, account-required services (Resend needs an API key and a verified sending
  domain; Twilio needs an account, a funded balance, and a phone number) — same class of
  decision as the GitHub Pages hosting blocker above, not something to sign up for
  unilaterally. Set `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS` (domain must be verified with
  Resend), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and
  optionally `ADMIN_ALERT_PHONE_NUMBER` in Railway to go live — no code changes needed.
- Deliberately out of scope this pass: the "forgot password" email template. No
  password-reset token system exists yet (the similarly-named
  `0020_password_reset_and_error_logs.sql` migration only added `must_change_password`
  and `error_logs` — no actual reset-token infrastructure) — that's part of the still-
  queued "forgot password" feature, not something to half-build a template for here.
