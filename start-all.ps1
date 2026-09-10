# OrganMatch - Start Docker + Fabric Blockchain
# Run this script in PowerShell from the project root

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\temporary projects\organ project"
$FabricNetworkDir = "$ProjectRoot\blockchain\test-network\test-network"
$DockerDesktopExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   OrganMatch - Docker & Fabric Startup Script" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# ─── STEP 1: Start Docker Desktop ─────────────────────────────────────────────
Write-Host "[1/4] Checking Docker Desktop..." -ForegroundColor Yellow

$dockerRunning = $false
try {
    $result = & docker info --format "{{.ServerVersion}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
        Write-Host "      Docker Desktop engine is already running (v$result)" -ForegroundColor Green
    }
} catch { }

if (-not $dockerRunning) {
    $backendExe = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\com.docker.backend.exe"
    if (Test-Path $backendExe) {
        Write-Host "      Starting Docker Engine via com.docker.backend..." -ForegroundColor Yellow
        Start-Process -FilePath $backendExe -WindowStyle Hidden
    } elseif (Test-Path $DockerDesktopExe) {
        Write-Host "      Starting Docker Desktop..." -ForegroundColor Yellow
        Start-Process -FilePath $DockerDesktopExe -WindowStyle Minimized
    } else {
        Write-Host "      [ERROR] Docker Desktop is not installed at: $DockerDesktopExe" -ForegroundColor Red
        Write-Host "      Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
        exit 1
    }

    Write-Host "      Waiting for Docker engine to start (up to 120 seconds)..." -ForegroundColor Yellow
    $elapsed = 0
    $maxWait = 120
    while ($elapsed -lt $maxWait) {
        Start-Sleep -Seconds 4
        $elapsed += 4
        try {
            $ver = & docker info --format "{{.ServerVersion}}" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "      Docker engine ready (v$ver) after ${elapsed}s" -ForegroundColor Green
                $dockerRunning = $true
                break
            }
        } catch { }
        Write-Host "      Still waiting... ${elapsed}s elapsed" -ForegroundColor DarkGray
    }

    if (-not $dockerRunning) {
        Write-Host "" 
        Write-Host "      [WARNING] Docker engine did not start within ${maxWait}s." -ForegroundColor Red
        Write-Host "      Please open Docker Desktop manually and wait for 'Engine running'" -ForegroundColor Red
        Write-Host "      Then re-run this script." -ForegroundColor Red
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""

# ─── STEP 2: Start Hyperledger Fabric test-network ────────────────────────────
Write-Host "[2/4] Starting Hyperledger Fabric network..." -ForegroundColor Yellow

# Check if Fabric peer is already running
$peerUp = $false
try {
    $conn = New-Object System.Net.Sockets.TcpClient
    $conn.Connect("localhost", 7051)
    if ($conn.Connected) {
        $peerUp = $true
        $conn.Close()
    }
} catch { }

if ($peerUp) {
    Write-Host "      Fabric peer (localhost:7051) is already running." -ForegroundColor Green
} else {
    # Check if Fabric containers already exist in Docker
    $existingFabric = & docker ps -a --filter "name=peer0.org1.example.com" --format "{{.Names}}" 2>&1
    if ($existingFabric -like "*peer0.org1.example.com*") {
        Write-Host "      Resuming existing Fabric containers..." -ForegroundColor Yellow
        & docker start orderer.example.com couchdb0 couchdb1 ca_org1 ca_org2 ca_orderer peer0.org1.example.com peer0.org2.example.com 2>&1 | Out-Null
        Start-Sleep -Seconds 3
        try {
            $conn = New-Object System.Net.Sockets.TcpClient
            $conn.Connect("localhost", 7051)
            if ($conn.Connected) {
                $peerUp = $true
                $conn.Close()
                Write-Host "      Fabric peer successfully resumed on localhost:7051" -ForegroundColor Green
            }
        } catch { }
    }

    if (-not $peerUp) {
        Write-Host "      Launching Fabric network via WSL (Ubuntu)..." -ForegroundColor Yellow
        Write-Host "      This will take 30-60 seconds..." -ForegroundColor DarkGray
        Write-Host ""

        $script = "wsl -d Ubuntu -- bash -c 'cd ""/mnt/c/temporary projects/organ project/blockchain/test-network/test-network"" && ./network.sh up createChannel -c organ-donation-channel -ca'"
        Write-Host "      Running: $script" -ForegroundColor DarkGray
        Write-Host ""

        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", $script -WindowStyle Normal

        Write-Host "      Waiting for Fabric peer to become reachable on port 7051..." -ForegroundColor Yellow
        $elapsed = 0
        $maxWait = 120
        while ($elapsed -lt $maxWait) {
            Start-Sleep -Seconds 5
            $elapsed += 5
            try {
                $conn = New-Object System.Net.Sockets.TcpClient
                $conn.Connect("localhost", 7051)
                if ($conn.Connected) {
                    $peerUp = $true
                    $conn.Close()
                    Write-Host "      Fabric peer reachable on localhost:7051 after ${elapsed}s" -ForegroundColor Green
                    break
                }
            } catch { }
            Write-Host "      Still waiting... ${elapsed}s elapsed" -ForegroundColor DarkGray
        }

        if (-not $peerUp) {
            Write-Host ""
            Write-Host "      [WARNING] Fabric peer did not come up within ${maxWait}s." -ForegroundColor Red
            Write-Host "      Check the WSL terminal for errors." -ForegroundColor Red
            Write-Host "      The OrganMatch app will still work - blockchain features require a running peer." -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# ─── STEP 3: Start OrganMatch Application (Backend + Frontend) ────────────────
Write-Host "[3/4] Checking OrganMatch backend (port 8000)..." -ForegroundColor Yellow

$backendUp = $false
try {
    $conn = New-Object System.Net.Sockets.TcpClient
    $conn.Connect("localhost", 8000)
    if ($conn.Connected) {
        $backendUp = $true
        $conn.Close()
    }
} catch { }

if ($backendUp) {
    Write-Host "      Backend already running at http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "      Starting backend..." -ForegroundColor Yellow
    $backendCmd = """$ProjectRoot\backend\venv\Scripts\uvicorn.exe"" app.main:app --host 0.0.0.0 --port 8000"
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot\backend'; $backendCmd" -WindowStyle Minimized
    Start-Sleep -Seconds 5
    Write-Host "      Backend started at http://localhost:8000" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/4] Checking OrganMatch frontend (port 5173)..." -ForegroundColor Yellow

$frontendUp = $false
try {
    $conn = New-Object System.Net.Sockets.TcpClient
    $conn.Connect("localhost", 5173)
    if ($conn.Connected) {
        $frontendUp = $true
        $conn.Close()
    }
} catch { }

if ($frontendUp) {
    Write-Host "      Frontend already running at http://localhost:5173" -ForegroundColor Green
} else {
    Write-Host "      Starting frontend..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location '$ProjectRoot\frontend'; npm run dev" -WindowStyle Minimized
    Start-Sleep -Seconds 5
    Write-Host "      Frontend started at http://localhost:5173" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   OrganMatch is ready!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Frontend:   http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:    http://localhost:8000" -ForegroundColor White
Write-Host "   API Docs:   http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
if ($peerUp) {
    Write-Host "   Blockchain: localhost:7051 CONNECTED" -ForegroundColor Green
} else {
    Write-Host "   Blockchain: localhost:7051 OFFLINE (optional - start Fabric manually)" -ForegroundColor Yellow
}
Write-Host ""
