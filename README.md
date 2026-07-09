# LashlyAI

AI-powered lash artistry platform. Artists photograph a client's eye, get an AI-generated
lash map (style, curl, length-per-zone, diameter, fan type + visual zone diagram), save it
to a client profile, and ask an AI Lash Coach troubleshooting questions.

## Repo layout

- `mobile/` — React Native (TypeScript) app, iOS first
- `backend/` — Node.js + TypeScript API (Express), PostgreSQL, OpenAI-backed services
- `docs/` — lash-mapping rules engine source, API spec, roadmap

See `CLAUDE.md` for the full product brief and build roadmap.

## Getting started

### Backend

```bash
cd backend
cp .env.example .env   # fill in real values
npm install
npm run dev
```

Health check: `GET http://localhost:3000/health`

### Mobile

```bash
cd mobile
cp .env.example .env   # fill in real values
npm install
npx pod-install ios    # requires CocoaPods
npm run ios
```

### Database

Requires a local PostgreSQL instance. Set `DATABASE_URL` in `backend/.env`, then run
migrations:

```bash
cd backend
npm run migrate
```
