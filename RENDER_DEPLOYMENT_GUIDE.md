# Render Complete Deployment Guide for OrganMatch

This guide provides full instructions to deploy the entire **OrganMatch** stack (**PostgreSQL Database + FastAPI Backend + React Frontend**) on **Render** (100% Free).

---

## Method 1: 1-Click Deployment via Blueprint (Easiest & Recommended)

This repository includes a pre-configured [render.yaml](file:///c:/temporary%20projects/organ%20project/render.yaml) file that automatically orchestrates all 3 services together.

### Step 1: Push Code to GitHub
Ensure all recent changes are pushed:
```bash
git add .
git commit -m "Configure Render blueprint and deployment files"
git push origin main
```

### Step 2: Deploy on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. In the top navigation, click **"Blueprints"**.
3. Click **"New Blueprint Instance"**.
4. Select your GitHub repository (`organ-match`).
5. Render will automatically read `render.yaml` and display:
   - `organmatch-db` (PostgreSQL Database - Free)
   - `organmatch-backend` (FastAPI Python Web Service - Free)
   - `organmatch-frontend` (Node SSR Web Service - Free)
6. Click **"Apply"**.

Render will now provision the database, run all 13 Alembic migrations, seed the initial database, compile the frontend, and link the services together!

---

## Method 2: Manual Step-by-Step Deployment on Render Dashboard

If you prefer to create each service manually through the Render dashboard:

### Step 1: Create the PostgreSQL Database
1. Go to **Dashboard** > **New +** > **PostgreSQL**.
2. **Name**: `organmatch-db`
3. **Database**: `organmatch`
4. **User**: `organmatch_user`
5. **Plan**: Select **Free**.
6. Click **"Create Database"**.
7. Once created, copy the **Internal Database URL** (e.g., `postgres://organmatch_user:...@dpg-.../organmatch`).

---

### Step 2: Deploy the FastAPI Backend
1. Go to **Dashboard** > **New +** > **Web Service**.
2. Select your GitHub repository.
3. Configure the following:
   - **Name**: `organmatch-backend`
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
   - **Plan**: Select **Free**.
4. Scroll to **Environment Variables** and add:
   | Key | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | *(paste your Internal Database URL from Step 1)* | Automatically converted to asyncpg |
   | `APP_ENV` | `production` | Production mode |
   | `JWT_SECRET_KEY` | *(generate a random string or click generate)* | Used for auth token signing |
   | `JWT_REFRESH_SECRET_KEY` | *(generate another random string)* | Used for refresh token signing |
5. Click **"Create Web Service"**.
6. Once deployed, note your backend URL (e.g. `https://organmatch-backend.onrender.com`).

---

### Step 3: Deploy the React / TanStack Frontend
1. Go to **Dashboard** > **New +** > **Web Service**.
2. Select your GitHub repository.
3. Configure the following:
   - **Name**: `organmatch-frontend`
   - **Root Directory**: `frontend`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Plan**: Select **Free**.
4. Scroll to **Environment Variables** and add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Production environment |
   | `VITE_BACKEND_URL` | `https://organmatch-backend.onrender.com` | Your backend URL from Step 2 |
5. Click **"Create Web Service"**.
6. Render will build and launch your frontend at `https://organmatch-frontend.onrender.com`.

---

## 3. Verify Deployment & Log In

Once both services show **"Live"**:

1. Open your frontend URL: `https://organmatch-frontend.onrender.com`
2. Navigate to the login page (`/login`).
3. Sign in using the pre-seeded admin credentials:
   - **Username**: `admin`
   - **Password**: `OrganMatch2026!`
4. Verify:
   - **Admin Dashboard**: Shows active hospitals, donors, and organ statistics.
   - **Matching Engine**: Accessible under Coordinator and Doctor roles.
   - **API Swagger Docs**: Accessible at `https://organmatch-backend.onrender.com/docs`.

---

## 4. Important Notes for Render Free Tier

- **Spin-down on Inactivity**: Free web services sleep after 15 minutes of inactivity. The first request after a period of inactivity may take **30 to 50 seconds** while the container boots up. Subsequent requests respond instantly.
- **Database Expiration**: Render's free PostgreSQL databases remain active for 90 days. For permanent zero-cost hosting, you can also point `DATABASE_URL` to a free permanent instance on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
- **CORS Support**: The backend is already configured to automatically accept requests from any `https://*.onrender.com` or `https://*.vercel.app` domain.
