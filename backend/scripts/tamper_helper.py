"""
Tamper Helper for Playwright E2E Testing
=========================================
Performs controlled database modification, Fabric ledger querying, and guaranteed state restoration.
Used strictly for automated end-to-end verification and research evidence collection.
"""

import sys
import os
import json
import asyncio
import hashlib
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")))
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.env")))

from sqlalchemy.future import select
from app.database.session import async_session_maker
from app.models.allocation import Allocation
from app.blockchain.fabric_gateway import fabric_gateway

def compute_allocation_hash(alloc_data: dict) -> str:
    state_dict = {
        "id": str(alloc_data["id"]),
        "match_id": str(alloc_data["match_id"]),
        "organ_id": str(alloc_data["organ_id"]),
        "recipient_id": str(alloc_data["recipient_id"]),
        "status": str(alloc_data["status"]),
    }
    return hashlib.sha256(json.dumps(state_dict, sort_keys=True).encode("utf-8")).hexdigest()

async def read_allocation(alloc_id: str) -> dict:
    async with async_session_maker() as session:
        res = await session.execute(select(Allocation).where(Allocation.id == alloc_id))
        alloc = res.scalars().first()
        if not alloc:
            raise ValueError(f"Allocation {alloc_id} not found in PostgreSQL")
        return {
            "id": str(alloc.id),
            "match_id": str(alloc.match_id),
            "organ_id": str(alloc.organ_id),
            "recipient_id": str(alloc.recipient_id),
            "status": alloc.status,
            "fabric_tx_id": alloc.fabric_tx_id,
        }

async def update_status(alloc_id: str, new_status: str):
    async with async_session_maker() as session:
        res = await session.execute(select(Allocation).where(Allocation.id == alloc_id))
        alloc = res.scalars().first()
        if not alloc:
            raise ValueError(f"Allocation {alloc_id} not found in PostgreSQL")
        alloc.status = new_status
        await session.commit()

async def get_fabric_asset(alloc_id: str) -> dict:
    if not fabric_gateway.connected:
        await fabric_gateway.connect()
    raw = await fabric_gateway.evaluate_transaction("GetAsset", alloc_id)
    if not raw:
        return {}
    return json.loads(raw)

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python tamper_helper.py <command> <alloc_id> [args]"}))
        sys.exit(1)

    cmd = sys.argv[1]
    alloc_id = sys.argv[2]

    try:
        if cmd == "read":
            data = await read_allocation(alloc_id)
            db_hash = compute_allocation_hash(data)
            fabric_asset = await get_fabric_asset(alloc_id)
            print(json.dumps({
                "allocation": data,
                "db_hash": db_hash,
                "fabric_asset": fabric_asset,
                "fabric_hash": fabric_asset.get("state_hash"),
                "hashes_match": db_hash == fabric_asset.get("state_hash")
            }))

        elif cmd == "tamper":
            orig = await read_allocation(alloc_id)
            orig_hash = compute_allocation_hash(orig)
            await update_status(alloc_id, "REJECTED")
            tampered = await read_allocation(alloc_id)
            tampered_hash = compute_allocation_hash(tampered)
            fabric_asset = await get_fabric_asset(alloc_id)
            print(json.dumps({
                "original_status": orig["status"],
                "original_db_hash": orig_hash,
                "tampered_status": tampered["status"],
                "tampered_db_hash": tampered_hash,
                "fabric_hash": fabric_asset.get("state_hash"),
                "fabric_tx_id": orig.get("fabric_tx_id"),
                "tampering_detected": tampered_hash != fabric_asset.get("state_hash")
            }))

        elif cmd == "restore":
            restore_status = sys.argv[3] if len(sys.argv) > 3 else "FABRIC_CONFIRMED"
            await update_status(alloc_id, restore_status)
            restored = await read_allocation(alloc_id)
            restored_hash = compute_allocation_hash(restored)
            fabric_asset = await get_fabric_asset(alloc_id)
            print(json.dumps({
                "restored_status": restored["status"],
                "restored_db_hash": restored_hash,
                "fabric_hash": fabric_asset.get("state_hash"),
                "verified": restored_hash == fabric_asset.get("state_hash")
            }))

        elif cmd == "fabric_check":
            fabric_asset = await get_fabric_asset(alloc_id)
            print(json.dumps({
                "fabric_asset": fabric_asset,
                "fabric_hash": fabric_asset.get("state_hash")
            }))

        elif cmd == "get_allocation":
            match_id = alloc_id if alloc_id != "latest" else None
            async with async_session_maker() as session:
                alloc = None
                for _ in range(25):
                    if match_id:
                        res = await session.execute(select(Allocation).where(Allocation.match_id == match_id))
                    else:
                        res = await session.execute(select(Allocation).order_by(Allocation.created_at.desc()))
                    alloc = res.scalars().first()
                    if alloc and alloc.fabric_tx_id:
                        break
                    await asyncio.sleep(1)
                if not alloc and match_id:
                    res = await session.execute(select(Allocation).order_by(Allocation.created_at.desc()))
                    alloc = res.scalars().first()

                if alloc:
                    print(json.dumps({
                        "id": str(alloc.id),
                        "status": alloc.status,
                        "fabric_tx_id": alloc.fabric_tx_id,
                        "match_id": str(alloc.match_id),
                    }))
                else:
                    print(json.dumps({}))

        elif cmd == "reset_baseline":
            async with async_session_maker() as session:
                from app.models.organ import Organ
                from app.models.recipient import Recipient
                from app.models.match import Match
                from app.models.medical_assessment import MedicalAssessment
                from app.models.blockchain_transaction import BlockchainTransaction
                from sqlalchemy import delete
                
                res = await session.execute(select(Organ).where(Organ.organ_code == 'ORG-K001'))
                organ = res.scalars().first()
                if organ:
                    organ.status = 'AVAILABLE'
                
                res = await session.execute(select(Recipient).where(Recipient.recipient_code == 'R101'))
                recip = res.scalars().first()
                if recip:
                    recip.status = 'ACTIVE'
                
                if organ:
                    res = await session.execute(select(Allocation).where(Allocation.organ_id == organ.id))
                    allocs = res.scalars().all()
                    for a in allocs:
                        await session.execute(delete(BlockchainTransaction).where(BlockchainTransaction.record_id == a.id))
                        await session.delete(a)
                    
                    res = await session.execute(select(Match).where(Match.organ_id == organ.id))
                    matches = res.scalars().all()
                    for m in matches:
                        m.status = 'PENDING'
                        await session.execute(delete(MedicalAssessment).where(MedicalAssessment.entity_id == m.id))
                
                await session.commit()
                print(json.dumps({"status": "reset_success"}))

        else:
            print(json.dumps({"error": f"Unknown command {cmd}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
