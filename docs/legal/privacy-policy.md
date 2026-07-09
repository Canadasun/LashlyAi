# LashlyAI Privacy Policy

> **STATUS: DRAFT — REQUIRES LEGAL REVIEW BEFORE PUBLISHING OR SUBMITTING TO THE APP
> STORE.** This is a reasonable starting point, not legal advice. Have a lawyer review
> it — especially the sections on third-party AI processing and photographing
> non-users (your clients) — before this goes live. Replace every `[PLACEHOLDER]`.

Effective date: [PLACEHOLDER — DATE OF PUBLICATION]

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

- **Account information**: email address, authentication identity (via Firebase
  Authentication), role (e.g. beginner, certified, salon owner).
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

## How we use this information

- To generate eye analyses and lash maps (client photos and derived data are sent to
  OpenAI's API for AI processing — see below).
- To save and let you retrieve client profiles and lash map history.
- To answer AI Lash Coach questions.
- To respond to feedback and fix bugs/crashes.
- To maintain your account and subscription status.

## Who we share data with

- **OpenAI** — client eye photos and related prompts are sent to OpenAI's API to
  generate eye analyses and Lash Coach answers. OpenAI processes this data under its
  own API data usage terms.
- **Firebase / Google** — used for authentication, and (planned) analytics, crash
  reporting, and push notifications.
- **Apple** — Sign in with Apple (when enabled) and StoreKit subscription payments.
- **Cloud storage provider** — client photos are stored on our storage provider
  ([PLACEHOLDER: AWS S3 in production] / a local development stub during testing).

We do not sell your data or your clients' photos to third parties for advertising.

## Data retention and deletion

Client profiles, photos, and lash maps are retained until you delete them or close
your account. To request deletion of your account or client data, contact
[PLACEHOLDER: privacy contact email].

## Children's data

LashlyAI is not directed at children under 13, and we do not knowingly collect account
information from anyone under 13.

## Your rights

Depending on where you live, you may have rights to access, correct, or delete your
data. Contact [PLACEHOLDER: privacy contact email] to make a request.

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

[PLACEHOLDER: business name, address, and contact email]
