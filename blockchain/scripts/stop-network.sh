#!/bin/bash
set -e

# Secure Organ Donation - Hyperledger Fabric Shutdown Script

echo "===================================================="
echo " Stopping Hyperledger Fabric Network"
echo "===================================================="

TEST_NETWORK_DIR="$(dirname "$0")/../test-network"

if [ -d "$TEST_NETWORK_DIR" ]; then
    echo "Tearing down official test-network in $TEST_NETWORK_DIR"
    cd "$TEST_NETWORK_DIR"
    ./network.sh down
    echo "Fabric network successfully terminated."
else
    echo "Local 'test-network' directory not found. Cleaning up standard Fabric containers..."
    
    # Standalone clean fallback if docker containers are running
    CONTAINERS=$(docker ps -a --filter name=peer --filter name=orderer --filter name=ca -q)
    if [ -n "$CONTAINERS" ]; then
        docker stop $CONTAINERS
        docker rm $CONTAINERS
        echo "Cleaned up standard Fabric containers."
    else
        echo "No running Fabric containers detected."
    fi
fi

echo "===================================================="
echo " Fabric Network Shutdown Completed."
echo "===================================================="
