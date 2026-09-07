# OrganMatch — Windows Setup & Usage Guide

> **Supported platform: Windows 10/11 only**
>
> All normal commands in this README use **Windows PowerShell**.
> Docker Desktop is the recommended development environment.


## 1. What This Project Is

OrganMatch is an academic full-stack organ donation matching system with:

- React + Vite frontend
- FastAPI backend
- PostgreSQL 16 database
- RBAC + ABAC authorization
- Donor, recipient, organ, matching, clinical review, and allocation workflows
- Optional Hyperledger Fabric integration
- Admin system monitoring

The matching engine is deterministic and rule-based; the supplied project documentation states that there is no machine-learning training pipeline.


## 2. Windows Requirements

Install:

| Software | Requirement | Purpose |
|---|---|---|
| Windows | 10/11 | Operating system |
| Docker Desktop | Required | PostgreSQL, backend, Nginx |
| WSL2 | Required for Fabric tooling when needed | Fabric support |
| Node.js | LTS, v18+ | Frontend |
| npm | Included with Node.js | Frontend packages |
| Python | 3.12 | Only if backend runs outside Docker |
| Git | Current version | Source control |
| Go | 1.20+ | Only for Fabric chaincode compilation |

Verify:

```powershell
docker --version
docker compose version
node --version
npm --version
python --version
git --version
wsl --status
```


## 3. Project Location

Example Windows project path:

```powershell
cd "C:\temporary projects\organ project"
```

Expected top-level folders/files include:

```text
organ project/
├── backend/
├── frontend/
├── nginx/
├── blockchain/
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env
└── .env.example
```


## 4. First-Time Setup

### 4.1 Configure environment variables

From PowerShell:

```powershell
cd "C:\temporary projects\organ project"
Copy-Item .env.example .env
```

Use real values for your local environment.

Important variables include:

```dotenv
APP_ENV=development
PQC_ENABLED=false

POSTGRES_DB=organ_donation_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-password>
POSTGRES_PORT=5432

DATABASE_URL=postgresql+psycopg://postgres:<password>@postgres:5432/organ_donation_db

JWT_SECRET_KEY=<secure-random-key>
JWT_REFRESH_SECRET_KEY=<different-secure-random-key>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

For optional Fabric configuration:

```dotenv
FABRIC_NETWORK=organ-donation-network
FABRIC_CHANNEL=organ-donation-channel
FABRIC_CHAINCODE=organ-contract
FABRIC_MSP_ID=Org1MSP
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CERT_PATH=
FABRIC_KEY_PATH=
```

Never commit real passwords, JWT keys, certificates, or private keys.


## 5. Start the Application — Recommended Windows Method

### PowerShell Window 1 — Docker

```powershell
cd "C:\temporary projects\organ project"

docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Check services:

```powershell
docker compose ps
```

Run migrations:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic upgrade head
```

### PowerShell Window 2 — Frontend

```powershell
cd "C:\temporary projects\organ project\frontend"

npm install
npm run dev
```

Open:

```text
http://localhost:5173
```


## 6. Application URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend Swagger | http://localhost:8000/docs |
| Backend health | http://localhost:8000/health |
| Database health | http://localhost:8000/health/database |
| Blockchain status | http://localhost:8000/health/blockchain |

The Vite development server proxies `/api/*` requests to the FastAPI backend.


## 7. Docker Desktop on Windows

Docker Desktop must be running before Docker Compose commands.

### Start

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

### Stop

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

### Stop and remove PostgreSQL volume

> This removes persisted database data.

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

### View containers

```powershell
docker compose ps
```

### Backend logs

```powershell
docker compose logs backend -f
```

### PostgreSQL logs

```powershell
docker compose logs postgres -f
```

### Restart backend

```powershell
docker compose restart backend
```


## 8. Database and Migrations

Database:

```text
organ_donation_db
```

Docker database host:

```text
postgres
```

Windows/local database host:

```text
localhost
```

Port:

```text
5432
```

Migration tool:

```text
Alembic
```

Run:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic upgrade head
```

Check current revision:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic current
```

Show migration history:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic history
```


## 9. Backend Without Docker — Windows Only

Only use this when Python is installed locally.

```powershell
cd "C:\temporary projects\organ project\backend"

python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

python -m alembic upgrade head

python -m uvicorn app.main:app --reload --port 8000
```

Alternative:

```powershell
python run_server.py
```

For local Windows execution, `backend/.env` should point PostgreSQL to `localhost:5432`.


## 10. Frontend — Windows

```powershell
cd "C:\temporary projects\organ project\frontend"

npm install
npm run dev
```

Useful commands:

```powershell
npm run build
npm run build:dev
npm run preview
npm run lint
npm run format
```

Vite uses port `5173` by default.


## 11. Port Reference

| Service | Port |
|---|---:|
| Vite frontend | 5173 |
| FastAPI backend | 8000 |
| PostgreSQL | 5432 |
| Nginx development | 8080 |
| Fabric Peer | 7051 |
| Fabric Orderer | 7050 |
| Fabric CA | 7054 |

Check a Windows port:

```powershell
netstat -ano | findstr :5173
netstat -ano | findstr :8000
netstat -ano | findstr :5432
```

Stop a process:

```powershell
taskkill /PID <PID> /F
```


## 12. Authentication

The documented authentication flow is:

```text
Login form
   ↓
POST /api/auth/login
   ↓
PostgreSQL user lookup
   ↓
Password hash verification
   ↓
JWT access token + refresh mechanism
   ↓
Protected API requests
```

Main endpoints:

```text
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

Passwords must remain database-backed and hashed. Do not add plaintext passwords or hardcode credentials.


## 13. Main Workflows

### Donor

```text
/coordinator/donors/new
POST /api/donors/
```

### Recipient

```text
/coordinator/recipients/new
POST /api/recipients/
```

### Organ

```text
/coordinator/organs/new
POST /api/organs/
```

### Matching

```text
/coordinator/matching
POST /api/matching/run
```

The supplied project documentation describes a two-stage deterministic matcher:

1. Hard eligibility checks such as blood compatibility and organ-specific rules.
2. Weighted scoring using blood, medical, HLA/tissue, and priority/urgency factors.

### Allocation

```text
/allocation/matches
/allocation/matches/:matchId
```

The workflow includes clinical review, allocation request, approval/rejection, PostgreSQL commit, and optional Fabric anchoring.


## 14. Admin Monitoring

Admin monitoring is available at:

```text
http://localhost:5173/admin/monitoring
```

Main monitoring API prefix:

```text
/api/admin/system
```

The monitoring pages should report actual backend/system state. Do not hardcode service health or fake live values.


## 15. Hyperledger Fabric on Windows

Fabric is optional.

When Fabric is required on Windows:

1. Use Docker Desktop.
2. Enable WSL2.
3. Install the required Fabric binaries/tooling.
4. Use the project's PowerShell scripts.

Check WSL2:

```powershell
wsl --status
wsl --list --verbose
```

Start the network:

```powershell
cd "C:\temporary projects\organ project"
.\blockchain\scripts\start-network.ps1
```

Deploy chaincode:

```powershell
.\blockchain\scripts\deploy-chaincode.ps1
```

Stop the network:

```powershell
.\blockchain\scripts\stop-network.ps1
```

Fabric should only be reported as healthy when the configured network, certificates/keys, and peer connectivity are actually available.


## 16. Testing — Windows

### Backend tests in Docker

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest
```

### Backend tests locally

```powershell
cd "C:\temporary projects\organ project\backend"
.\venv\Scripts\Activate.ps1
python -m pytest tests/ -v
```

### Frontend build

```powershell
cd "C:\temporary projects\organ project\frontend"
npm run build
```

### Frontend lint

```powershell
npm run lint
```


## 17. Windows Troubleshooting

### Docker problem

```powershell
docker version
docker compose version
docker compose ps
```

### Backend problem

```powershell
docker compose logs backend
```

### PostgreSQL problem

```powershell
docker compose logs postgres
netstat -ano | findstr :5432
```

### Frontend port 5173 already in use

```powershell
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

Then restart:

```powershell
cd "C:\temporary projects\organ project\frontend"
npm run dev
```

### PowerShell blocks virtual-environment activation

Check:

```powershell
Get-ExecutionPolicy
```

A commonly used per-user setting for local development is:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then:

```powershell
.\venv\Scripts\Activate.ps1
```

### Login returns 401

Check:

- Username/email
- Password
- User status
- Database connection
- JWT environment configuration

### Login returns 502

Check:

```powershell
docker compose ps
docker compose logs backend
```

Then:

```powershell
curl.exe http://localhost:8000/health
```

### HTTPS certificate warning

Development uses HTTP by default:

```text
http://localhost:5173
```

Use HTTPS only when valid development certificates are configured.


## 18. Production — Windows

Build the frontend:

```powershell
cd "C:\temporary projects\organ project\frontend"
npm run build
```

Start production Compose:

```powershell
cd "C:\temporary projects\organ project"

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Check:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Use secure environment variables and valid HTTPS certificates for production.


## 19. Windows Verification Checklist

```text
[ ] Docker Desktop is running
[ ] Docker Compose starts successfully
[ ] PostgreSQL is healthy
[ ] Backend is running
[ ] Alembic migrations are complete
[ ] http://localhost:8000/health works
[ ] http://localhost:8000/health/database works
[ ] Frontend starts at http://localhost:5173
[ ] Login works with the database user
[ ] RBAC/ABAC works
[ ] Donor workflow works
[ ] Recipient workflow works
[ ] Organ workflow works
[ ] Matching works
[ ] Clinical review works
[ ] Allocation workflow works
[ ] Admin monitoring works
[ ] Fabric is reported healthy only when actually connected
[ ] npm run build succeeds
[ ] No real secrets are committed
```

---

## 20. Windows-Only Rule

This README intentionally excludes Linux/macOS setup commands.

For normal project work, use:

```text
Windows PowerShell
Docker Desktop
WSL2 only where Fabric tooling requires it
```

Do not replace Windows PowerShell commands with Unix commands unless the project explicitly requires a WSL2 operation for Fabric tooling.
