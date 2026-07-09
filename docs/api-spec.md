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

## Clients

### `POST /clients`
Create a client profile.

Request:
```json
{ "name": "Jane Doe", "notes": "optional" }
```

### `GET /clients`
Returns all `ClientProfile` records owned by the current user, newest first.

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
