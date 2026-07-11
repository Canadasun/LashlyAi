# Enterprise remediation backlog

This backlog parks the findings from the 2026-07-10 production-readiness audit. Work is
ordered by release risk and implementation weight. An item is only complete after code,
tests, deployment, and production verification are all finished.

## P0 — release blockers

- [ ] Private, durable client-photo storage, authenticated delivery, and complete deletion
  - In progress: Railway S3-compatible storage, media ownership records, file validation,
    authenticated image delivery, and client deletion.
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

