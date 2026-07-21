# LashlyAI API Spec (v1 minimum)

Base URL: `http://localhost:3000` (dev)

All authenticated routes expect `Authorization: Bearer <firebase_id_token>`.

## Auth

Firebase itself owns email/password sign-up and sign-in — the mobile app calls the
Firebase client SDK directly for those and gets back an ID token. There's no backend
`/auth/login`; the backend only needs to link that Firebase identity to a Postgres row.

### `POST /auth/register`
Call once right after Firebase sign-up (and it's safe to call again on every sign-in —
idempotent). Verifies the bearer token and creates the matching `User` row if one
doesn't exist yet.

Request: empty body, or `{ "role": "beginner" }` to set an initial role.

Response `200` (already existed) or `201` (newly created): full `User` record.

In dev, before a real Firebase project is configured, pass
`Authorization: Bearer dev:<email>` — see `backend/src/services/auth.service.ts`.

## Users

### `GET /users/me`
Response `200`: full `User` record (see data model).

### `GET /users/me/usage`
Free-tier quota status: client profiles (5), coach questions today (5), eye scans
this month (3). Paid plans show `limit: null` (unlimited). `enforced` reflects the
`ENFORCE_PLAN_LIMITS` env var — off during testing, so nothing is actually blocked yet
even when `allowed: false` would otherwise apply.

Response `200`:
```json
{
  "plan": "free",
  "enforced": false,
  "client_profiles": { "used": 0, "limit": 5, "allowed": true },
  "coach_questions_today": { "used": 0, "limit": 5, "allowed": true },
  "eye_scans_this_month": { "used": 0, "limit": 3, "allowed": true }
}
```

## Clients

### `POST /clients`
Create a client profile.

Request:
```json
{ "name": "Jane Doe", "notes": "optional" }
```

### `GET /clients`
Returns all `ClientProfile` records owned by the current user, newest first. Optional
`?q=<text>` query param filters by name (case-insensitive substring match), used by the
client directory's search box.

### `GET /clients/:id`
Returns a `ClientProfile` including photos, eye_analysis, lash_history, notes.

### `POST /clients/:id/eye-analysis`
Multipart upload (photo) → runs AI eye-analysis (OpenAI vision).

Response `201`:
```json
{
  "eye_shape": "almond",
  "lash_density": "medium",
  "lash_length_natural": "medium",
  "notes": "string, AI-generated observations"
}
```

### `POST /clients/:id/lash-map`
Body: `{ "eye_analysis_id": "..." }` (or inline eye_analysis JSON). Optionally
`requested_style` / `requested_technique` / `requested_lash_set` / `requested_lash_style`,
or `custom_lash_map` (Pro-gated, `{label, curl, diameter, lengths}`), or `template_id`
(Pro-gated, applies a saved [`/lash-map-templates`](#post-lash-map-templates) entry —
equivalent to submitting that same template's fields inline).
Runs the deterministic rules engine (see `/docs/lash-rules.md`) to produce a `LashMap`,
including a computed Service Difficulty score/label and estimated appointment-length
range (see `backend/src/services/serviceDifficulty.service.ts` — estimates, not
owner-verified figures).

Response `201`: full `LashMap` record, including `difficulty_score`, `difficulty_label`
(`Quick | Standard | Technical | Expert-Level`), and `estimated_minutes: {min, max}`.

### `GET /clients/:id/lash-maps`
Returns array of saved `LashMap` records for the client.

### `POST /lash-map-templates`
Pro tier (same gate as `custom_lash_map` above — zero access on free). Body:
`{label, curl, diameter, lengths}`, same shape/validation as an inline custom lash map.
Saves a reusable personal "signature set" independent of any one client.

Response `201`: the saved `LashMapTemplate` record.

### `GET /lash-map-templates`
Pro tier. Returns the current user's saved templates, newest first.

### `DELETE /lash-map-templates/:id`
Pro tier, ownership-checked (403 if it belongs to another user). Response `204`.

### `POST /clients/:id/photo-feedback`
Multipart upload (photo of the artist's **completed** lash application, not the
pre-work client eye) → AI scores isolation, direction, and styling (see
`/docs/lash-rules.md` §7 for the rubric). A different input than `eye-analysis` —
this scores finished work, not a bare natural eye.

Response `201`:
```json
{
  "photo_url": "string",
  "isolation_score": 0,
  "direction_score": 0,
  "styling_score": 0,
  "overall_score": 0,
  "notes": "string",
  "mock": false
}
```

### `GET /clients/:id/photo-feedback`
Returns array of saved `PhotoFeedback` records for the client, newest first.

### `POST /clients/:id/photo-edit`
Pro tier (zero access on free — 403 with an upgrade prompt, not a reduced quota).
Multipart upload (`photo`) of a client-side-edited image (filters/adjustments applied
in the mobile app via Skia) → stored as the client's final high-res export. Distinct
from `photo-feedback` (AI-scored) — this is a manual editing tool, reachable from the
client profile's "Edit Photo" button and from the dashboard/client-list "Photo Editor"
quick action (which routes through the client picker since editing is always scoped to
one client's photo).

Response `201`:
```json
{ "photo_url": "string" }
```

### `POST /clients/:id/photo-retouch`
Pro tier (zero access on free — 403 with an upgrade prompt, not a reduced quota).
Multipart upload (`photo`) + `consented: "true"` → AI skin retouch (smooths rough/uneven
texture, softens blemishes/redness) via a real OpenAI `images.edit` (`gpt-image-1`)
call, prompted to preserve the client's identity, eye shape, and any lash extensions
already visible in the photo unchanged. Requires explicit consent (400 without it) since
it's an AI-altered image of the client's face, same as `lash-preview`. A real,
per-call-billed AI request — distinct from the free client-side `photo-edit` above —
gated by its own monthly quota (`checkPhotoRetouchQuota`, free: 0, paid: unlimited while
`ENFORCE_PLAN_LIMITS` is on). Falls back to returning the original photo tagged
`"mock": true` when `OPENAI_API_KEY` isn't configured. Reachable from the "AI Retouch"
card at the top of the mobile Photo Editor screen, gated behind its own consent
checkbox distinct from the photo-edit/upload consent implied by opening the editor.

Response `201`:
```json
{ "photo_url": "string", "mock": false }
```

### `POST /clients/:id/lash-maps/:mapId/retention-check`
Pro tier: reports symptoms of a retention problem and gets AI troubleshooting advice.
Persists `retention_pct` onto the referenced `LashMap` row, and (as of 2026-07-21) a full
`RetentionCheck` row (`days_since_application`, `retention_pct`, `humidity_pct`,
`glue_used`, `symptoms`) feeding Retention Intelligence below — previously this data
only fed the one AI call and was discarded.

Request:
```json
{ "days_since_application": 14, "retention_pct": 60, "symptoms": ["excess oil", "rubbing eyes"] }
```

Response `200`:
```json
{ "advice": "string", "mock": false, "lash_map": { "...": "updated LashMap record" } }
```

### `GET /clients/:id/retention-insights`
Pro tier (`checkRetentionInsightsAccess`, same flat gate as inventory/custom lash maps).
Returns this client's full retention-check history plus a linear next-fill projection
from the most recent check — an estimate (`backend/src/services/retentionInsights.service.ts`),
not a clinical model.

Response `200`:
```json
{
  "checks": [{ "days_since_application": 14, "retention_pct": "80.00", "humidity_pct": "45.00", "glue_used": "string", "symptoms": [], "lash_set": "volume", "style": "volume", "created_at": "..." }],
  "next_fill_estimate": { "estimated_days_remaining": 14, "estimated_fill_day": 28 }
}
```
`next_fill_estimate` is `null` when there isn't enough signal to project from (no
checks yet, or retention hasn't dropped).

### `GET /users/me/retention-insights`
Pro tier. Cross-client aggregate across every retention check this artist has ever
logged — "which lash set/glue held up best" — the iPad-only "Retention Analytics" view
on mobile (not shown on phone; screen size drove that call, not a plan gate).

Response `200`:
```json
{
  "by_lash_set": [{ "label": "volume", "average_retention_pct": 80, "sample_size": 1 }],
  "by_glue": [{ "label": "Glue A", "average_retention_pct": 80, "sample_size": 1 }],
  "total_checks": 1
}
```

## Coach

### `POST /coach/ask`
Request:
```json
{ "question": "Why are my fans closing?" }
```

Optional `client_id` (Pro tier, `checkClientAwareCoachAccess`, as of 2026-07-21): folds
that client's eye analysis, most recent lash map, and retention-check history into the
prompt so the answer is grounded in their actual data instead of generic
troubleshooting. 404 if the client isn't owned by the caller; the question itself still
counts against the normal Coach quota either way.
```json
{ "question": "Why is retention low for this client?", "client_id": "..." }
```

Response `200`:
```json
{ "answer": "string" }
```

System prompt is scoped strictly to lash troubleshooting — not general chat.

## Feedback

### `POST /feedback`
In-app "report an issue" intake (Phase 2).

Request:
```json
{ "message": "App crashed when I tapped Analyze twice quickly", "context": { "screen": "CameraUpload" } }
```

Response `201`: full `Feedback` record, linked to the reporting user.

## Inventory

Pro tier. Owner-scoped (not shared between users yet — that's a Studio-tier feature).

### `POST /inventory`
Request: `{ "name": "string", "category": "lash_trays|glue|tools|other", "quantity": 0, "unit": "string", "low_stock_threshold": 0, "notes": "string" }`

### `GET /inventory`
Returns all items owned by the current user, each with a computed `is_low_stock` boolean.

### `PATCH /inventory/:id`
Partial update — any subset of the create fields.

### `DELETE /inventory/:id`
Response `204`.

## Marketing

Pro tier. AI-generated drafts — no client scoping.

### `POST /marketing/caption`
Request: `{ "post_description": "Just finished a mega volume set with a dramatic cat-eye" }`
Response `200`: `{ "caption": "string", "hashtags": ["string"], "mock": false }`

### `POST /marketing/reply`
Request: `{ "client_message": "Can I reschedule to next week?" }`
Response `200`: `{ "reply": "string", "mock": false }`

## Lessons

Free tier. Seeded with **placeholder curriculum content** — see migration
`0007_lessons.sql` — not real training material yet.

### `GET /lessons`
Returns all 10 lessons ordered by `order_index`, each with a `completed` boolean for
the current user.

### `GET /lessons/:id`
Single lesson detail + `completed` flag.

### `POST /lessons/:id/complete`
Marks complete for the current user (idempotent). Response `204`.

## Forum

Free tier. Not owner-scoped — every authenticated user can read/post/comment on
every post (it's a community forum, not a private space).

### `POST /forum/posts`
Request: `{ "title": "string", "body": "string" }`

### `GET /forum/posts`
Returns all posts, newest first, each with `author_email` and `comment_count`.

### `GET /forum/posts/:id`
Post detail including a `comments` array (oldest first, each with `author_email`).

### `POST /forum/posts/:id/comments`
Request: `{ "body": "string" }`

## Subscriptions

### `POST /subscriptions/verify`
Verifies an Apple StoreKit receipt against Apple's `verifyReceipt` endpoint (production,
falling back to sandbox per Apple's documented status-21007 flow) and upserts the
user's `Subscription` row — one per user, updated in place as their plan changes.

Request:
```json
{ "receipt_data": "<base64 App Store receipt>" }
```

Response `200`: full `Subscription` record, plus `mock: false`.

**Dev mode** (no `APPLE_SHARED_SECRET` configured yet — no real App Store Connect
subscription products exist): pass `{ "plan": "pro" }` directly instead of a receipt.
Response includes `mock: true`. See `backend/src/services/appleReceipt.service.ts` for
the placeholder product-ID → plan mapping that must be updated once real products are
created in App Store Connect.

Response `200`: updated `Subscription` record.

---

## Billing (Stripe, web-only)

Separate from the Subscriptions section above — this is for salon/enterprise
customers who sign up via lashlyai.com, not the mobile app. The mobile app never
calls any of these; it stays 100% Apple StoreKit / Google Play Billing per App Store
guideline 3.1.1. Every route below returns `503` if `STRIPE_SECRET_KEY` isn't
configured, same philosophy as `/subscriptions/verify` and `APPLE_SHARED_SECRET`.

### `POST /billing/checkout`
Creates a Stripe Checkout Session (hosted by Stripe — no custom checkout UI in this
repo) for the given plan and returns its URL to redirect the browser to.

Request:
```json
{ "plan": "pro" }
```
`plan` must be one of `pro`, `educator`, `salon`, `enterprise` — `free` isn't billable.
Returns `503` if that specific plan has no `STRIPE_PRICE_ID_*` configured yet.

Response `200`: `{ "url": "https://checkout.stripe.com/..." }`

### `POST /billing/portal`
Creates a Stripe Billing Portal session (hosted by Stripe — cancel, upgrade/downgrade,
update payment method, view invoices, all without custom UI in this repo) for the
current user's existing Stripe customer. `404` if the user has never checked out via
Stripe (no `stripe_customer_id` on their `Subscription` row yet).

Response `200`: `{ "url": "https://billing.stripe.com/..." }`

### `POST /billing/webhook`
Stripe calls this directly (not the mobile app or a browser) — verified via the
`stripe-signature` header against `STRIPE_WEBHOOK_SECRET`, not a Bearer token. Handles
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`, and `charge.refunded`,
syncing the same `Subscription` row the mobile app's `getUserPlan()` reads — a user's
plan/quota access is correct regardless of which provider they paid through.
Idempotent per Stripe event id (`stripe_webhook_events` table) — safe against Stripe's
automatic retries.

### `GET /billing/success` / `GET /billing/cancel`
Minimal branded landing pages Checkout redirects the browser to after payment
succeeds or is canceled. No side effects — the actual subscription sync happens via
the webhook above, not these pages.

### `POST /admin/billing/refund`
Admin-only (2FA-gated, same pattern as `/admin/grants`). Refunds a Stripe-billed
subscriber's most recent invoice in full. Apple/StoreKit subscribers must be refunded
via App Store Connect instead — Apple doesn't expose a refund API to third parties.

Request:
```json
{ "email": "artist@example.com", "reason": "requested_by_customer" }
```
`reason` is optional, one of Stripe's own reason enum (`duplicate`, `fraudulent`,
`requested_by_customer`) if provided.

Response `201`: `{ "stripe_refund_id": "...", "amount": 4900, "currency": "usd", "status": "succeeded" }`

---

This spec will grow as Phase 1+ features land. Keep it in sync with actual route
handlers in `backend/src/routes/`.
