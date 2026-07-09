# LashlyAI — Master Build Brief for Claude Code

You (the coding agent) are building LashlyAI, an iOS-first AI lash artistry platform.
Read this entire file before writing any code. Work phase by phase, in order. Do not skip
ahead to later phases before earlier ones are functional and committed to git.

## 0. Product Summary

LashlyAI helps lash artists, educators, salons, and academies do their work better using AI.

Core loop (this is the product's reason to exist — protect it above all else):

1. Artist photographs a client's eye.
2. AI analyzes eye shape + natural lash characteristics.
3. AI generates a lash map: style, curl, length-per-zone, diameter, fan type, plus a
   visual zone diagram (inner → outer, spike lengths, direction arrows).
4. Artist saves the map to a client profile (photo, history, notes, retention %).
5. Artist can ask an AI Lash Coach troubleshooting questions ("why are my fans closing?").

Everything else (education platform, marketplace, salon team management, inventory,
marketing AI, community) is real, valuable, and staged for after the core loop works.

## 1. Brand

- Name: LashlyAI
- Feeling: Charlotte Tilbury x luxury beauty academy x AI tech — premium, feminine, trustworthy.
- Colors:
  - Primary — Dusty Rose `#D98FAF`
  - Accent — Champagne Gold `#C9A45C`
  - Background — Soft Nude `#F7E8E3`
  - Text — Charcoal `#2B2B2B`

Avoid bright/childish pink, avoid generic "AI app" neon/purple gradients.

## 2. Tech Stack (locked — do not substitute without asking)

| Layer | Choice |
|---|---|
| Mobile | React Native + TypeScript (iOS first, Android later from same codebase) |
| Backend | Node.js + TypeScript (Express or Fastify) |
| Database | PostgreSQL |
| AI | OpenAI API (vision + chat) behind a rules engine built from `/docs/lash-rules.md` (stub with sane defaults if empty) |
| Image storage | AWS S3 (local-disk stub in dev if AWS creds aren't provided yet) |
| Auth | Firebase Authentication (email/password, Apple Sign In, Google Sign In) |
| Payments | Apple StoreKit for iOS subscriptions (Stripe deferred to web phase) |
| Analytics | Firebase Analytics |
| Push | Firebase Cloud Messaging |
| Hosting | AWS or GCP — use environment variables, don't hardcode a provider |

## 3. Repo Structure

```
LashlyAI/
├── mobile/              # React Native app (TypeScript)
├── backend/             # Node.js + TypeScript API
│   ├── src/
│   │   ├── routes/
│   │   ├── services/    # ai.service.ts, lashmap.service.ts, storage.service.ts
│   │   ├── models/       # User, ClientProfile, LashMap, Subscription
│   │   ├── db/           # migrations, schema
│   │   └── index.ts
│   └── .env.example
├── docs/
│   ├── lash-rules.md     # owner-provided styling/mapping knowledge — stub for now
│   ├── api-spec.md
│   └── roadmap.md
├── .gitignore
├── README.md
└── CLAUDE.md             # this file
```

## 4. Data Models (v1 minimum)

```
User
  id, email, password_hash (if not using Firebase-only), role [beginner|certified|educator|salon_owner|academy],
  experience_level, certifications[], specialties[], location, preferred_styles[], created_at

ClientProfile
  id, owner_user_id, name, photos[], eye_analysis (jsonb), lash_history[], notes, created_at

LashMap
  id, client_profile_id, style, curl, lengths (jsonb per zone), diameter, fan_type,
  visual_map (jsonb: zones/spikes/direction), retention_pct, created_at

Subscription
  id, user_id, plan [free|pro|educator|salon|enterprise], status, apple_transaction_id, renews_at
```

## 5. API Endpoints (v1 minimum)

```
POST   /auth/register
POST   /auth/login
GET    /users/me
POST   /clients                    # create client profile
GET    /clients/:id
POST   /clients/:id/eye-analysis   # upload photo -> AI eye analysis
POST   /clients/:id/lash-map       # generate lash map from analysis
GET    /clients/:id/lash-maps
POST   /coach/ask                  # AI lash coach Q&A
POST   /subscriptions/verify       # verify Apple StoreKit receipt
```

## 6. Phased Roadmap — BUILD IN THIS ORDER

### Phase 0 — Scaffolding (day 1)

- [ ] Initialize git repo, .gitignore, README, folder structure above.
- [ ] mobile/: RN + TypeScript app boots to a branded splash screen (colors from §2).
- [ ] backend/: Express/Fastify server boots, health check route `/health`.
- [ ] PostgreSQL schema migration for the 4 models in §4.
- [ ] `.env.example` files in both mobile/ and backend/ — never commit real `.env`.
- [ ] Commit after each checkbox with a clear message.

### Phase 1 — Core MVP (the one-week target)

- [ ] Auth: email/password + Apple Sign In via Firebase (Google Sign In can stub/skip for v1 if time-constrained).
- [ ] Camera upload screen → image goes to storage service (S3 or local stub).
- [ ] AI eye-analysis service: sends photo to OpenAI vision, returns structured eye + lash characteristics JSON (schema in §4).
- [ ] Lash map generator service: takes eye-analysis JSON + `/docs/lash-rules.md` → returns structured LashMap (style, curl, lengths, diameter, fan) using the rules engine, not raw model guesswork for the technical values.
- [ ] Visual map rendering: simple zone diagram (inner→outer with per-zone lengths) — SVG or Skia in RN, doesn't need to be fancy in v1.
- [ ] Save client profile + lash map to Postgres via API.
- [ ] AI Lash Coach: simple chat screen hitting `/coach/ask`, backed by OpenAI with a system prompt scoped to lash troubleshooting only.
- [ ] End-to-end smoke test: sign up → photo → analysis → map → save → view saved client.

Definition of done for Phase 1: a real device (or simulator) can complete the full loop
above without crashing, with data persisting in Postgres and images in storage. This is
the "one week" deliverable — it is a working prototype, not an App-Store-approved product.

### Phase 2 — Internal Testing (2–3 weeks)

- [ ] TestFlight build, internal testers group.
- [ ] Crash/error logging (Sentry or Firebase Crashlytics).
- [ ] Feedback intake (even a simple in-app "report an issue" form is fine for v1).
- [ ] Track AI accuracy manually — owner reviews generated maps against real lash-artist judgment and logs corrections into `/docs/lash-rules.md`.

### Phase 3 — App Store Preparation

- [ ] Apple Developer account, App Store Connect listing.
- [ ] Screenshots, app icon, privacy policy, terms of service.
- [ ] StoreKit subscription products configured (Free/Pro/Educator/Salon/Enterprise tiers — start with Free + Pro only for v1 submission, add tiers after).
- [ ] Submit for review.

### Phase 4 — Production Launch (v1.0)

- [ ] AI lash mapping, client profiles, save designs — live.
- [ ] Monitoring/alerting on backend (uptime, error rates).
- [ ] Basic admin view (even a simple internal dashboard) to see signups and flagged AI outputs.

### Phase 5 — Enterprise Expansion (post-launch, ongoing)

Build only after Phase 4 is stable in production. Order by revenue impact, not by
excitement:

- [ ] AI photo feedback (score artist's own work: isolation/direction/styling)
- [ ] Client before/after timeline, automated retention reminders
- [ ] Education platform (lessons, quizzes, AI practice coach, certificates)
- [ ] Educator platform (course creation, revenue share, teacher dashboard)
- [ ] Salon team management (staff, assigned clients, performance)
- [ ] Inventory management (lash/glue stock, expiry alerts)
- [ ] Marketing AI (captions, hashtags, booking replies, aftercare messages)
- [ ] Marketplace (brands/educators/artists buying and selling)
- [ ] Community (groups, challenges, live events, mentorship)
- [ ] GDPR + PIPEDA compliance pass, formal security review, SOC2-track infra if pursuing enterprise/salon accounts seriously

## 7. Working Agreements for the Agent

- Commit after every meaningful chunk of work, with descriptive messages. Never leave the
  working tree in a broken, uncommitted state at the end of a session.
- Never commit secrets. `.env` files are gitignored; only `.env.example` is committed.
- Prefer boring, working code over clever code. This ships to real paying customers.
- When the lash-mapping technical values (curl/length/diameter/fan) are being decided,
  route them through a deterministic rules engine informed by `/docs/lash-rules.md`, not
  purely free-form AI output — accuracy here is the product's credibility.
- If `/docs/lash-rules.md` is empty or thin, use conservative, clearly-labeled placeholder
  defaults and flag them for the owner to review — do not silently invent lash industry
  standards.
- Ask before: choosing a cloud provider, choosing a payment processor beyond StoreKit,
  or making any change that costs real money (API usage tiers, paid infra).
- After each phase, summarize what was built and what's left before moving to the next phase.
