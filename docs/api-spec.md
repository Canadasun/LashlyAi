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

## Subscriptions

### `POST /subscriptions/verify`
Verifies an Apple StoreKit receipt/transaction.

Request:
```json
{ "apple_transaction_id": "..." }
```

Response `200`: updated `Subscription` record.

---

This spec will grow as Phase 1+ features land. Keep it in sync with actual route
handlers in `backend/src/routes/`.
