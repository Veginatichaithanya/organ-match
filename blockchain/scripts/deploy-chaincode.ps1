# Secure Organ Donation - Hyperledger Fabric Chaincode Deployment Script for Windows PowerShell

Write-Host "====================================================" -ForegroundColor Green
Write-Host " Deploying Organ Contract Go Chaincode (Windows)" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

$TestNetworkDir = Join-Path $PSScriptRoot "..\test-network"
$RealNetworkDir = (Resolve-Path $TestNetworkDir -ErrorAction SilentlyContinue).Path

if ($RealNetworkDir) {
    Write-Host "Found test-network at $RealNetworkDir. Deploying CC via WSL..." -ForegroundColor Cyan
    # Convert paths to WSL format using wslpath
    $WslPath = (wsl wslpath -a -u "$RealNetworkDir").Trim()
    $CcLocalPath = (Resolve-Path (Join-Path $PSScriptRoot "..\chaincode\organ-contract")).Path
    $WslCcPath = (wsl wslpath -a -u "$CcLocalPath").Trim()
    
    # Run the deployment command inside WSL
    $BashCmd = "cd '$WslPath/test-network' && ./network.sh deployCC -ccn organ-contract -ccp '$WslCcPath' -ccl go -c organ-donation-channel -ccs 1"
    wsl -d Ubuntu -- bash -lc "$BashCmd"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Chaincode deployment failed inside WSL (exit code $($LASTEXITCODE))." -ForegroundColor Red
        Write-Host "====================================================" -ForegroundColor Red
        Exit 1
    }
    
    Write-Host "Chaincode 'organ-contract' successfully deployed to channel 'organ-donation-channel' inside WSL." -ForegroundColor Green
} else {
    Write-Host "Local 'test-network' directory not found." -ForegroundColor Yellow
    Write-Host "Resolving local Go smart contract dependencies..." -ForegroundColor Cyan
    
    $ccPath = Join-Path $PSScriptRoot "..\chaincode\organ-contract"
    Push-Location $ccPath
    
    & go version > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
        & go mod tidy
        Write-Host "Go dependencies resolved successfully." -ForegroundColor Green
    } else {
        Write-Host "Warning: Go is not installed locally. Cannot run 'go mod tidy'." -ForegroundColor Yellow
    }
    Pop-Location
}

Write-Host "====================================================" -ForegroundColor Green
Write-Host " Chaincode Deployment Script Completed." -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
