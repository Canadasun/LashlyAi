# Enterprise remediation backlog

This backlog parks the findings from the 2026-07-10 production-readiness audit. Work is
ordered by release risk and implementation weight. An item is only complete after code,
tests, deployment, and production verification are all finished.

## P0 — release blockers

- [x] Private, durable client-photo storage, authenticated delivery, and complete deletion
  - Production verified on 2026-07-10: Railway object storage, tenant-owned media records,
    decoded/normalized uploads, authenticated delivery, client deletion, and account deletion.
- [ ] Production StoreKit purchase flow and entitlement verification
- [ ] Accurate iOS privacy manifest, reviewed legal documents, consent, export, and account deletion
- [ ] Hardened authentication: secure device storage, password reset, email verification,
  session revocation, admin identities, MFA, and audit trail
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
- [ ] **No audit logging, bulk operations, or CSV export** anywhere in the backend —
  relevant if pursuing salon/enterprise accounts seriously (ties into the existing P0
  "admin identities... audit trail" item).
