"""
Development/Test Script: Controlled Real Tampering Verification Cycle
====================================================================
Simulates unauthorized direct database alteration on a real Fabric-anchored record,
verifies detection by the cryptographic verification engine, confirms ledger immutability,
and ensures guaranteed safe restoration of PostgreSQL state in a finally block.

DO NOT use in production. DEVELOPMENT USE ONLY.
"""

import sys
import os
import json
import asyncio
import hashlib

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.future import select
from app.database.session import async_session_maker
from app.models.allocation import Allocation
from app.blockchain.fabric_gateway import fabric_gateway

TARGET_ALLOCATION_ID = "e2fa29c2-8f17-411f-8245-ac12dbd23172"
EXPECTED_FABRIC_TX = "26e06a7a8ee3084ece4989ab5a31f3d97fda5c97aeb78257f2614fdd7bc298b5"
EXPECTED_FABRIC_HASH = "f5badb14fb1e746b3be26fa360c04461cf31eb8efabdd8294e63f7c4cc68e0ab"

def compute_allocation_hash(alloc_data: dict) -> str:
    """Canonical SHA-256 state hash formula matching chaincode and backend verification."""
    state_dict = {
        "id": str(alloc_data["id"]),
        "match_id": str(alloc_data["match_id"]),
        "organ_id": str(alloc_data["organ_id"]),
        "recipient_id": str(alloc_data["recipient_id"]),
        "status": str(alloc_data["status"]),
    }
    return hashlib.sha256(json.dumps(state_dict, sort_keys=True).encode("utf-8")).hexdigest()

async def read_db_allocation(alloc_id: str) -> dict:
    async with async_session_maker() as session:
        result = await session.execute(select(Allocation).where(Allocation.id == alloc_id))
        alloc = result.scalars().first()
        if not alloc:
            raise ValueError(f"Allocation record {alloc_id} not found in PostgreSQL.")
        return {
            "id": str(alloc.id),
            "match_id": str(alloc.match_id),
            "organ_id": str(alloc.organ_id),
            "recipient_id": str(alloc.recipient_id),
            "status": alloc.status,
            "fabric_tx_id": alloc.fabric_tx_id,
        }

async def update_db_status(alloc_id: str, new_status: str):
    async with async_session_maker() as session:
        result = await session.execute(select(Allocation).where(Allocation.id == alloc_id))
        alloc = result.scalars().first()
        if not alloc:
            raise ValueError(f"Allocation record {alloc_id} not found in PostgreSQL.")
        alloc.status = new_status
        await session.commit()

async def run_tampering_test():
    print("=" * 70)
    print("REAL TAMPERING DETECTION AND RESTORATION TEST")
    print("=" * 70)
    print(f"Target Allocation ID : {TARGET_ALLOCATION_ID}")
    print(f"Associated Fabric TX : {EXPECTED_FABRIC_TX}")
    print(f"Expected Fabric Hash : {EXPECTED_FABRIC_HASH}")

    # Connect to Fabric Gateway
    print("\n[INIT] Connecting to Hyperledger Fabric Gateway...")
    await fabric_gateway.connect()
    if not fabric_gateway.connected:
        raise RuntimeError("Hyperledger Fabric gateway is offline. Live ledger connection required.")
    print("[INIT] Connected to Fabric Peer successfully.")

    # 1. Read asset from Fabric
    print("\n[STEP 1] Querying real Fabric ledger using GetAsset...")
    raw_asset = await fabric_gateway.evaluate_transaction("GetAsset", TARGET_ALLOCATION_ID)
    if not raw_asset:
        raise RuntimeError(f"Fabric ledger returned empty asset for {TARGET_ALLOCATION_ID}")
    asset = json.loads(raw_asset)
    fabric_hash = asset.get("state_hash")
    print(f"  Fabric Asset Data : {asset}")
    print(f"  Fabric Hash       : {fabric_hash}")
    assert fabric_hash == EXPECTED_FABRIC_HASH, f"Hash mismatch: got {fabric_hash}, expected {EXPECTED_FABRIC_HASH}"

    # 2. Read baseline from PostgreSQL
    print("\n[STEP 2] Reading PostgreSQL baseline state...")
    original_db = await read_db_allocation(TARGET_ALLOCATION_ID)
    original_status = original_db["status"]
    original_db_hash = compute_allocation_hash(original_db)
    print(f"  Original DB Status: {original_status}")
    print(f"  Original DB Hash  : {original_db_hash}")
    print(f"  Fabric Hash       : {fabric_hash}")

    # 3. Verify Baseline
    print("\n[STEP 3] Verifying baseline match (DB Hash == Fabric Hash)...")
    if original_db_hash != fabric_hash:
        raise AssertionError(f"Baseline failed! DB Hash ({original_db_hash}) != Fabric Hash ({fabric_hash})")
    print("  Baseline Status   : VERIFIED (PASS)")

    test_passed = False
    try:
        # 4. Tamper ONE field directly in PostgreSQL
        print("\n[STEP 4] Directly tampering PostgreSQL: status = 'REJECTED'...")
        await update_db_status(TARGET_ALLOCATION_ID, "REJECTED")
        tampered_db = await read_db_allocation(TARGET_ALLOCATION_ID)
        tampered_db_hash = compute_allocation_hash(tampered_db)
        print(f"  Tampered DB Status: {tampered_db['status']}")
        print(f"  Tampered DB Hash  : {tampered_db_hash}")

        # 5. Verify Mismatch
        print("\n[STEP 5] Verifying mismatch on tampered state...")
        print(f"  Tampered DB Hash  : {tampered_db_hash}")
        print(f"  Fabric Ledger Hash: {fabric_hash}")
        if tampered_db_hash == fabric_hash:
            raise AssertionError("Tampering test failed: hashes should NOT match after tampering!")
        print("  Tampering Result  : TAMPERING_DETECTED (PASS)")

        # 6. Verify Fabric remains unchanged
        print("\n[STEP 6] Re-querying Fabric to confirm ledger immutability...")
        raw_asset_check = await fabric_gateway.evaluate_transaction("GetAsset", TARGET_ALLOCATION_ID)
        asset_check = json.loads(raw_asset_check)
        fabric_hash_after = asset_check.get("state_hash")
        print(f"  Fabric Hash After : {fabric_hash_after}")
        assert fabric_hash_after == EXPECTED_FABRIC_HASH, "Fabric ledger hash was modified!"
        print("  Fabric Hash Changed: NO (Ledger is completely immutable)")

        test_passed = True

    finally:
        # 7. Guaranteed Restoration of original PostgreSQL state
        print("\n[STEP 7] Restoring original PostgreSQL state in finally block...")
        await update_db_status(TARGET_ALLOCATION_ID, original_status)
        restored_db = await read_db_allocation(TARGET_ALLOCATION_ID)
        restored_db_hash = compute_allocation_hash(restored_db)
        print(f"  Restored DB Status: {restored_db['status']}")
        print(f"  Restored DB Hash  : {restored_db_hash}")
        print(f"  Fabric Hash       : {fabric_hash}")

        # 8. Verify Restored State
        print("\n[STEP 8] Verifying restored state...")
        assert restored_db["status"] == original_status, f"Failed to restore status to {original_status}"
        assert restored_db_hash == fabric_hash, "Restored DB hash does not match Fabric ledger hash!"
        print("  Restored Result   : VERIFIED (PASS)")

    print("\n" + "=" * 70)
    print("FINAL TEST RESULT: REAL TAMPERING DETECTION TEST = PASS")
    print("=" * 70)
    return test_passed

if __name__ == "__main__":
    success = asyncio.run(run_tampering_test())
    sys.exit(0 if success else 1)
