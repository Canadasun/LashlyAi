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
Body: `{ "eye_analysis_id": "..." }` (or inline eye_analysis JSON).
Runs the deterministic rules engine (see `/docs/lash-rules.md`) to produce a `LashMap`.

Response `201`: full `LashMap` record.

### `GET /clients/:id/lash-maps`
Returns array of saved `LashMap` records for the client.

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
Persists `retention_pct` onto the referenced `LashMap` row.

Request:
```json
{ "days_since_application": 14, "retention_pct": 60, "symptoms": ["excess oil", "rubbing eyes"] }
```

Response `200`:
```json
{ "advice": "string", "mock": false, "lash_map": { "...": "updated LashMap record" } }
```

## Coach

### `POST /coach/ask`
Request:
```json
{ "question": "Why are my fans closing?" }
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

This spec will grow as Phase 1+ features land. Keep it in sync with actual route
handlers in `backend/src/routes/`.
