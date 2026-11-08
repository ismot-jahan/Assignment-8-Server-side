# Shomaj – Server (Express + MongoDB)

REST API for the **Shomaj** social development events platform.

- Live API: `https://YOUR-SERVER-URL`
- Client repo: link your client repository here

## Features

- Express + TypeScript API connected to MongoDB (official driver)
- JWT protected routes – tokens are issued by Better Auth on the client and verified here with its public JWKS (`jose`)
- Events CRUD with ownership checks (only the creator can update/delete)
- Server-side validation (future-only dates, URL, length rules)
- Join / leave events, one join per user per event (unique index)
- Upcoming-only listing with search, type filter and `limit`

## Endpoints

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/events?limit=&type=&search=` | public (upcoming only) |
| GET | `/api/events/:id` | public |
| GET | `/api/events/mine` | JWT |
| POST | `/api/events` | JWT |
| PUT / DELETE | `/api/events/:id` | JWT + owner |
| GET | `/api/events/:id/joined` | JWT |
| POST | `/api/events/:id/join` | JWT |
| GET | `/api/joins/mine` | JWT |
| DELETE | `/api/joins/:eventId` | JWT |
| GET | `/api/stats` | public |

## Run locally

```bash
# 1. Start MongoDB (downloads mongod once, then runs it locally - no install)
cd shomaj-server
npm run db

# 2. Configure both apps
cp .env.example .env   # server
cd ../shomaj-client && cp .env.example .env

# 3. Run
npm run dev            # server -> http://localhost:5000
cd ../shomaj-client && npm run dev   # client -> http://localhost:3000
```

`.env` files are already filled in for local development; the defaults point at
`mongodb://127.0.0.1:27017` with database `shomaj`. `npm run db` is idempotent -
if something is already listening on 27017 it just says so and exits.

Use the **same** `MONGODB_URI` and `DB_NAME` in the client. Deploy on Render: build `npm install && npm run build`, start `npm start`, and set `CLIENT_URL` to your deployed client URL (and `MONGODB_URI` to your Atlas cluster).
