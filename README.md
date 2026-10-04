# AI Rank Checker

Sign up, enter a domain, and get page-by-page fixes for Google, ChatGPT, Gemini, Claude,
Perplexity and Reddit. The site is crawled by the backend and the reports are written by DeepSeek.

## Structure

| Folder | Stack | Job |
|---|---|---|
| `frontend/` | React 18, Vite, React Router | Landing page, sign up, sign in, audit dashboard |
| `backend/` | Spring Boot 3, Java 17, Spring Security (JWT), JPA | Accounts, crawling, DeepSeek streaming |

### API

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/signup` | Public | Create an account (name, email, password of 8+ characters) |
| `POST /api/auth/login` | Public | Returns a JWT valid for 7 days |
| `GET /api/auth/me` | JWT | Current user |
| `GET /api/discover?site=` | JWT | Homepage, robots.txt rules for 11 crawlers, sitemap, llms.txt |
| `GET /api/page?site=&url=` | JWT | On-page signals for one page |
| `POST /api/analyze` | JWT | Streams one platform's report as plain text |

Passwords are stored as BCrypt hashes. The crawler refuses private and internal addresses.

## Run locally

Backend (needs Java 17):

```
cd backend
mvnw.cmd spring-boot:run
```

Frontend (needs Node 18+), in a second terminal:

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend on port 8080.

## Configuration

Backend settings come from environment variables, or from `backend/.env` when running locally.

| Variable | Required | Purpose |
|---|---|---|
| `DEEPSEEK_API_KEY` | Yes | DeepSeek key. Stays on the server. |
| `JWT_SECRET` | In production | 32+ random characters. If unset, a random key is used and everyone is signed out on restart. |
| `DATABASE_URL` | In production | `jdbc:postgresql://host/db?sslmode=require`. Defaults to an H2 file in `backend/data`. |
| `DATABASE_USERNAME`, `DATABASE_PASSWORD` | With Postgres | Database credentials. |
| `CORS_ORIGINS` | In production | The frontend's URL, for example `https://your-site.netlify.app`. |
| `DEEPSEEK_MODEL` | No | Defaults to `deepseek-chat`. |

Frontend: set `VITE_API_URL` to the backend's public URL when building for production.

## Deploy

Netlify serves static sites and JavaScript functions; it cannot run a Java server. So:

1. **Backend** on a host that runs Docker or Java (for example Render, Railway, Fly.io or Koyeb) using
   `backend/Dockerfile`, with the variables above. Use a hosted Postgres database (for example Neon):
   the default H2 file is wiped whenever a free container restarts, which would delete all accounts.
2. **Frontend** on Netlify. `netlify.toml` already sets the build. Add `VITE_API_URL` in the Netlify
   environment variables, then `netlify deploy --prod`.
3. Set `CORS_ORIGINS` on the backend to the Netlify URL.

## Limits

- Reports use only what is on the site. No rankings, traffic, backlinks or brand mentions.
- Up to 50 pages per audit, taken from the sitemap, shallowest first.
- Pages that need JavaScript to show content are flagged, not rendered.
- The Reddit mention check runs from the browser and is skipped if Reddit refuses it.
- Audits are not saved; download the report to keep it.
