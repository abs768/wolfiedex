# Deployment

This repo is set up for a split deployment:

- `frontend` on Vercel
- `backend` on DigitalOcean App Platform

## Frontend on Vercel

Create a Vercel project with:

- Root Directory: `frontend`
- Framework Preset: `Next.js`

Set this environment variable in Vercel:

- `API_BASE_URL=https://<your-digitalocean-backend-domain>`

The frontend proxies `POST /api/search` to that backend URL through [frontend/next.config.mjs](/Users/omkar/Downloads/wolfiedex/frontend/next.config.mjs:1).

## Backend on DigitalOcean

Create an App Platform service with:

- Source Directory: `backend`
- Build Command: `npm run build`
- Run Command: `npm run start`

Set these runtime environment variables:

- `MONGODB_URI`
- `GROQ_API_KEY`
- `MONGODB_DB=campus_events`
- `FRONTEND_ORIGIN=https://<your-vercel-frontend-domain>`

The backend route is exposed at `POST /api/search` from [backend/src/app/api/search/route.ts](/Users/omkar/Downloads/wolfiedex/backend/src/app/api/search/route.ts:144).

## Order

1. Deploy `backend` to DigitalOcean first.
2. Copy the public backend URL.
3. Set `API_BASE_URL` in Vercel to that backend URL.
4. Deploy `frontend` to Vercel.
5. Set `FRONTEND_ORIGIN` in DigitalOcean to the final Vercel domain and redeploy the backend.

## Local Development

- Frontend uses `API_BASE_URL` from `frontend/.env.local`.
- Default local fallback is `http://127.0.0.1:3001`.
- Backend uses `FRONTEND_ORIGIN` from `backend/.env.local`.

Use the included examples as templates:

- `frontend/.env.example`
- `backend/.env.example`
