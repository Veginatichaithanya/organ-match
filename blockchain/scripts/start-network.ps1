# Secure Organ Donation - Hyperledger Fabric Startup Script for Windows PowerShell
# Adapts the official test-network configurations.

Write-Host "====================================================" -ForegroundColor Green
Write-Host " Starting Hyperledger Fabric Network (Windows/WSL)" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

# Check if Docker is running
& docker info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker Desktop is not running. Please start Docker Desktop before running this script."
    Exit 1
}

$TestNetworkDir = Join-Path $PSScriptRoot "..\test-network"
$RealNetworkDir = (Resolve-Path $TestNetworkDir -ErrorAction SilentlyContinue).Path

if ($RealNetworkDir) {
    Write-Host "Found test-network at $RealNetworkDir. Invoking scripts via WSL bash..." -ForegroundColor Cyan
    # Convert path to WSL format using wslpath
    $WslPath = (wsl wslpath -a -u "$RealNetworkDir").Trim()
    
    # Run the start commands inside WSL environment
    $BashCmd = "cd '$WslPath/test-network' && ./network.sh down && ./network.sh up createChannel -c organ-donation-channel -ca -s couchdb"
    wsl -d Ubuntu -- bash -lc "$BashCmd"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Fabric network initialization failed inside WSL (exit code $($LASTEXITCODE))." -ForegroundColor Red
        Write-Host "====================================================" -ForegroundColor Red
        Exit 1
    }
    
    Write-Host "Fabric network successfully initialized on channel 'organ-donation-channel' inside WSL." -ForegroundColor Green
} else {
    Write-Host "Notice: Local 'test-network' directory not found." -ForegroundColor Yellow
    Write-Host "Please clone the official fabric-samples repository under 'blockchain' directory to enable full verification hooks:" -ForegroundColor Yellow
    Write-Host "git clone https://github.com/hyperledger/fabric-samples.git blockchain/test-network" -ForegroundColor Yellow
    Exit 1
}

Write-Host "====================================================" -ForegroundColor Green
Write-Host " Fabric Network Setup Completed." -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
