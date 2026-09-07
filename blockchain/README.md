# Hyperledger Fabric Network Configuration

This directory contains scripts, configurations, and smart contracts for the permissioned blockchain layer of the **Secure Organ Donation Matching and Tamper Detection System**.

## Organization Topology

The prototype network models a consortium consisting of 4 organizations and a Raft ordering service:

1. **Org1 (Hospital A)**: Registers local donors/recipients, manages locally harvested organs, and views matches.
2. **Org2 (Hospital B)**: Registers local donors/recipients, manages locally harvested organs, and views matches.
3. **Org3 (Transplant Center)**: Coordinates clinical suitability details and matches.
4. **Org4 (Allocation Authority)**: Central governing role authorizing matches and executing allocations.
5. **Orderer Org**: Houses the Raft Orderer service to bundle and distribute blocks.

---

## Directory Structure

```text
blockchain/
├── chaincode/
│   └── organ-contract/       # Go Smart Contract (Registers state hashes & audit alerts)
├── scripts/                  # Cross-platform orchestration scripts
│   ├── start-network.sh      # Starts CAs, Peers, Orderer, and joins Channel (Bash)
│   ├── start-network.ps1     # Windows PowerShell equivalent
│   ├── stop-network.sh       # Tears down the network containers and volume stores
│   ├── stop-network.ps1      # Windows PowerShell equivalent
│   ├── deploy-chaincode.sh   # Compiles and installs Go chaincode
│   └── deploy-chaincode.ps1  # Windows PowerShell equivalent
└── README.md                 # This documentation
```

---

## Deployment Prerequisites

### 1. Unix / macOS
- **Docker Engine** & **Docker Compose**
- **Go** (v1.20+)
- **Fabric Binaries & Docker Images** (v2.5.x recommended):
  To download binaries and Docker images locally, run:
  ```bash
  curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.4 1.5.7
  ```
  Ensure the generated `bin/` directory is added to your environment `PATH`.

### 2. Windows
- **Docker Desktop** running in **WSL2** backend mode.
- Git Bash or Ubuntu terminal running in WSL2 (highly recommended for executing Fabric peer commands).
- **Go** (for compiling chaincode locally if required).

---

## Network Command Guide

### Start the Network
This starts the Certificate Authorities (CAs), Peer nodes, Raft Orderer, and joins them to `organ-donation-channel`:
```bash
./blockchain/scripts/start-network.sh
```

### Deploy Smart Contract (Chaincode)
Compiles and deploys the Go chaincode package on the channels:
```bash
./blockchain/scripts/deploy-chaincode.sh
```

### Stop the Network
Terminates all Docker containers and cleans up ledger volumes:
```bash
./blockchain/scripts/stop-network.sh
```
