# Secure Organ Donation - Hyperledger Fabric Shutdown Script for Windows PowerShell

Write-Host "====================================================" -ForegroundColor Red
Write-Host " Stopping Hyperledger Fabric Network" -ForegroundColor Red
Write-Host "====================================================" -ForegroundColor Red

$TestNetworkDir = Join-Path $PSScriptRoot "..\test-network"
$RealNetworkDir = (Resolve-Path $TestNetworkDir -ErrorAction SilentlyContinue).Path

if ($RealNetworkDir) {
    Write-Host "Found test-network at $RealNetworkDir. Tearing down network via WSL..." -ForegroundColor Cyan
    # Convert path to WSL format using wslpath
    $WslPath = (wsl wslpath -a -u "$RealNetworkDir").Trim()
    
    $BashCmd = "cd '$WslPath/test-network' && ./network.sh down && docker rm -f `$(docker ps -a -q) 2>/dev/null || true"
    wsl -d Ubuntu -- bash -lc "$BashCmd"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Fabric network shutdown returned exit code $($LASTEXITCODE) inside WSL." -ForegroundColor Yellow
    } else {
        Write-Host "Fabric network successfully terminated inside WSL." -ForegroundColor Green
    }
} else {
    Write-Host "Tearing down standalone Fabric Docker containers..." -ForegroundColor Cyan
    
    # Standalone cleanup using standard docker filters in PowerShell
    $containers = docker ps -a --filter name=peer --filter name=orderer --filter name=ca -q
    if ($containers) {
        docker stop $containers
        docker rm $containers
        Write-Host "Stopped and removed standard Fabric containers." -ForegroundColor Green
    } else {
        Write-Host "No active Fabric containers detected." -ForegroundColor Yellow
    }
}

Write-Host "====================================================" -ForegroundColor Red
Write-Host " Fabric Network Shutdown Completed." -ForegroundColor Red
Write-Host "====================================================" -ForegroundColor Red
