# Vercel Deployment Guide for OrganMatch

This guide provides step-by-step instructions to host the **OrganMatch** project using **Vercel** for the frontend and **Render / Railway / Supabase** for the backend and database.

---

## 1. System Architecture & Hosting Model

OrganMatch is a multi-tier production system:
1. **Frontend**: React 19 + TanStack Start + Nitro + Tailwind CSS. Hosted on **Vercel**.
2. **Backend**: Python 3.12 + FastAPI + Alembic migrations. Hosted on **Render**, **Railway**, or **Fly.io**.
3. **Database**: PostgreSQL 16 with UUID and JSON extensions. Hosted on **Supabase**, **Neon**, or **Render PostgreSQL**.

> **Why can't Vercel host the database and FastAPI server directly?**  
> Vercel is a serverless platform built for web frontends and edge functions. Persistent databases (PostgreSQL) and long-running Python services (FastAPI with background workers) require a persistent server environment. 

---

## 2. Deploying the Frontend to Vercel

The frontend is fully configured with **Nitro for Vercel**, which compiles into Vercel's Build Output API v3 (`.vercel/output`).

### Step 1: Push Repository to GitHub
Ensure all latest code is committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Configure Vercel and Nitro deployment"
git push origin main
```

### Step 2: Import into Vercel
1. Log in to [vercel.com](https://vercel.com) and click **"Add New..." > "Project"**.
2. Select your GitHub repository (`organ-match`).

### Step 3: Configure Project Settings
In the Vercel project configuration screen:
* **Project Name**: `organmatch` (or your preferred name)
* **Root Directory**: Click **Edit** and choose `frontend`
* **Framework Preset**: Vercel will detect **Nitro** or **Vite** (leave default or select Vite)
* **Build Command**: `npm run build`
* **Output Directory**: (leave default; Nitro generates `.vercel/output` automatically)
* **Install Command**: `npm install`

### Step 4: Configure Environment Variables
Under **Environment Variables**, add:
| Key | Example Value | Description |
|---|---|---|
| `NITRO_PRESET` | `vercel` | Ensures Nitro builds with Vercel serverless adapter |
| `VITE_BACKEND_URL` | `https://your-backend.onrender.com` | Base URL of your deployed backend API |

### Step 5: Click Deploy
Click **Deploy**. Vercel will build the frontend and issue your live URL:
`https://<your-project>.vercel.app`

---

## 3. Connecting Frontend to Backend

You have two methods to connect your Vercel frontend to the backend:

### Method A: Vercel Rewrites (Recommended: Zero CORS & HttpOnly Cookie Support)
Vercel can act as a reverse proxy, routing all `/api/*` browser requests directly to your backend service so they appear on the same domain.

Edit `frontend/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:match*",
      "destination": "https://your-backend-api.onrender.com/api/:match*"
    }
  ]
}
```
Push the commit. Now, any request sent to `https://<your-app>.vercel.app/api/...` is automatically proxied without cross-origin cookie restrictions!

### Method B: Direct API Requests
If you prefer direct requests, simply set `VITE_BACKEND_URL=https://your-backend-api.onrender.com` in the Vercel environment variables.
The backend's CORS configuration in `app/main.py` is pre-configured to allow all `https://*.vercel.app` domains automatically:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 4. Hosting the Backend & PostgreSQL Database

To get the full system working, deploy the backend and database on a platform like **Render** or **Railway**.

### Option A: Render (Free/Low-Cost)

#### 1. Create PostgreSQL Database on Render:
1. On Render, click **New +** > **PostgreSQL**.
2. Name: `organmatch-db`, Database: `organmatch`, User: `organmatch_user`.
3. Copy the **Internal Database URL** (or External URL).

#### 2. Create Backend Web Service on Render:
1. Click **New +** > **Web Service**.
2. Select your repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && alembic upgrade head && python scripts/seed_all.py
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
4. Set Environment Variables on Render:
   - `DATABASE_URL`: `postgresql+asyncpg://organmatch_user:...@host/organmatch` (Replace `postgres://` with `postgresql+asyncpg://`)
   - `JWT_SECRET`: Generate a secure random string (e.g. `openssl rand -hex 32`)
   - `ALLOWED_ORIGINS`: `https://<your-project>.vercel.app`
   - `ENVIRONMENT`: `production`

---

### Option B: Railway (One-Click Monorepo)
1. In Railway, click **New Project** > **Provision PostgreSQL**.
2. Click **New Service** > **GitHub Repo** > Select `organ-match`.
3. In service settings, set **Root Directory** to `backend`.
4. Railway will automatically inject `DATABASE_URL`. Set `Start Command`:
   ```bash
   sh entrypoint.sh
   ```
   (This automatically applies migrations and seeds data).
5. Generate a public domain on Railway, e.g. `https://organmatch-api.up.railway.app`.

---

## 5. Verification & Seed Admin Credentials

Once both frontend and backend are deployed:
1. Open your Vercel URL (`https://your-project.vercel.app`).
2. Navigate to `/login`.
3. Log in with the pre-seeded admin account:
   - **Username**: `admin`
   - **Password**: `OrganMatch2026!`
4. Verify the Dashboard, Hospital Registry, Donors, Recipients, and Organ Matching views load clinical records.
