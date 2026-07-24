# LashlyAI Privacy Policy

> **STATUS: DRAFT — REQUIRES LEGAL REVIEW.** All placeholders are now filled in with
> real owner-provided details (2026-07-16), but this is a reasonable starting point
> filled in by an AI assistant, not legal advice. Have a lawyer review it — especially
> the sections on third-party AI processing and photographing non-users (your
> clients) — before treating this as production-final.

Effective date: July 24, 2026

LashlyAI ("we", "us") provides an app that helps lash artists analyze client eye
photos and generate AI-assisted lash maps. This policy explains what data we collect,
how we use it, and who we share it with.

## Important: this app processes photos of your clients, not just you

If you're a lash artist using LashlyAI, you upload photos of your clients' eyes so the
app can generate a lash map. **You are responsible for obtaining your client's consent
before photographing them and before their photo is processed by LashlyAI and its
third-party AI provider (OpenAI).** We recommend getting written or verbal consent as
part of your normal client intake process.

## Information we collect

- **Account information**: email address, password (stored as a salted hash, never in
  plain text) or your Apple ID identifier if you use Sign in with Apple, role (e.g.
  beginner, certified, salon owner).
- **Client data you enter**: client name, notes, eye photos, AI-generated eye analysis
  (eye shape, lash density, natural lash length), generated lash maps (style, curl,
  lengths, diameter, fan type), and lash history you save.
- **AI Lash Coach questions**: the troubleshooting questions you ask and the answers
  given.
- **Feedback/bug reports**: anything you submit through "Report an Issue," plus basic
  device/platform info attached automatically to help us diagnose problems.
- **Payment information**: subscription purchases are handled entirely by Apple's
  StoreKit — we receive a transaction identifier to verify your subscription status,
  never your payment card details.

## How we use this information, including face data sent to OpenAI

**Face data we collect**: client eye/lash-area photos you take or upload, and the
AI-generated eye analysis derived from them (eye shape, lash density, natural lash
length). This is face data — treat every feature below that says "photo" as referring
to this data.

Every app feature that sends a client photo to OpenAI requires you to first confirm,
in-app, that the client has consented to that specific photo being shared with OpenAI
— you cannot proceed without checking that box. The features that send a photo:

- **Eye Analysis** (`POST /clients/:id/eye-analysis`): the client's eye photo is sent
  to OpenAI's vision API to generate the eye-shape/lash-density analysis that the lash
  map is built from. This is the core feature of the app.
- **Score My Work / Photo Feedback** (`POST /clients/:id/photo-feedback`): a photo of
  the completed lash application is sent to OpenAI's vision API for feedback on
  isolation, direction, and styling.
- **AI After-Look Preview** (`POST /clients/:id/lash-preview`): the client's eye photo
  is sent to OpenAI's image-editing API to generate a preview of the finished lash
  look on that same photo.
- **AI Retouch** (`POST /clients/:id/photo-retouch`): a client photo is sent to
  OpenAI's image-editing API to smooth skin texture and reduce blemishes/redness.

Other AI features do **not** send a photo, only text: the **AI Lash Coach** sends your
typed question (and, if you asked about a specific client, short text context about
that client — not their photo) to OpenAI's chat API. **AI-generated social captions and
client-reply drafts** send text you provide (e.g. a client's first name, service type)
to OpenAI's chat API, never a photo.

We also use this information to save and let you retrieve client profiles and lash map
history, to respond to feedback and fix bugs/crashes, and to maintain your account and
subscription status.

## Who we share data with

- **OpenAI** — as detailed above: client photos for Eye Analysis, Photo Feedback, AI
  After-Look Preview, and AI Retouch; short text for AI Lash Coach and AI-generated
  captions/replies. As of this writing, OpenAI's own API terms state that data sent
  through its API is not used to train its models and is retained only briefly for
  abuse/safety monitoring, separate from any account-level retention described below —
  verify this against OpenAI's current terms before relying on it, since third-party
  policies can change.
- **Firebase / Google** — used for crash reporting (Crashlytics) only; analytics and
  push notifications are not currently implemented.
- **Apple** — Sign in with Apple (if you choose it) and StoreKit subscription payments.
- **Cloud storage provider** — client photos are stored in S3-compatible object
  storage (hosted via Railway), authenticated and private, not publicly accessible.

We do not sell your data or your clients' photos to third parties for advertising.

## Data retention and deletion

Client profiles, photos (including eye-analysis, photo-feedback, retouch, and preview
images), and lash maps are retained only for as long as the client profile or your
account exists — deleting a client profile immediately and permanently deletes its
photos and derived data, and deleting your account (in-app, under Settings > Delete
Account) immediately and permanently deletes every client profile, photo, and lash map
you own, with no separate retention period. Account deletion is instant and in-app; you
do not need to email us to request it, though you may still contact
support@lashlyai.com for help.

## Children's data

LashlyAI is not directed at children under 13, and we do not knowingly collect account
information from anyone under 13.

## Your rights

Depending on where you live, you may have rights to access, correct, or delete your
data. Contact support@lashlyai.com to make a request, or delete your account and all
client data yourself at any time in-app under Settings > Delete Account.

> Formal GDPR/PIPEDA compliance work (data processing agreements, regional data
> residency, etc.) is planned as a later-stage project (see `docs/roadmap.md` Phase 5)
> and is not yet complete as of this draft.

## Security

We use reasonable technical and organizational measures to protect your data, but no
system is 100% secure.

## Changes to this policy

We may update this policy as the app evolves. Material changes will be communicated
in-app or by email.

## Contact

Email: support@lashlyai.com
Idowu Ayeni, 3 St SE, Calgary, AB T2G 0T9, Canada
