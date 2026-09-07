#!/bin/bash
set -e

# Secure Organ Donation - Hyperledger Fabric Chaincode Deployment Script

echo "===================================================="
echo " Deploying Organ Contract Go Chaincode"
echo "===================================================="

TEST_NETWORK_DIR="$(dirname "$0")/../test-network"
CC_SRC_PATH="../chaincode/organ-contract"

if [ -d "$TEST_NETWORK_DIR" ]; then
    echo "Using official test-network deployment tools in $TEST_NETWORK_DIR"
    cd "$TEST_NETWORK_DIR"
    
    # Deploy chaincode on organ-donation-channel channel
    ./network.sh deployCC \
        -ccn organ-contract \
        -ccp "$CC_SRC_PATH" \
        -ccl go \
        -c organ-donation-channel
    
    echo "Chaincode 'organ-contract' successfully deployed to channel 'organ-donation-channel'."
else
    echo "Notice: Local 'test-network' directory not found at $TEST_NETWORK_DIR."
    echo "In standard environment, ensure Go dependencies are initialized before deployment:"
    cd "$(dirname "$0")/../chaincode/organ-contract"
    if command -v go &> /dev/null; then
        echo "Running 'go mod tidy' to tidy smart contract dependencies..."
        go mod tidy
        echo "Smart contract packages resolved successfully."
    else
        echo "Warning: Go is not installed locally. Cannot run 'go mod tidy'."
    fi
fi

echo "===================================================="
echo " Chaincode Deployment Script Completed."
echo "===================================================="
