import uuid
import json
import hashlib
import asyncio
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, String

from app.database.session import get_db
from app.models.user import User
from app.models.blockchain_transaction import BlockchainTransaction
from app.models.allocation import Allocation
from app.schemas.blockchain import BlockchainTransactionResponse
from app.security.authentication import get_current_user
from app.security.rbac import RequirePermission
from app.blockchain.fabric_gateway import fabric_gateway
from app.services.fabric_monitoring_service import fabric_monitoring_service

logger = logging.getLogger("blockchain_api")

router = APIRouter(
    prefix="/blockchain",
    tags=["Blockchain"],
    dependencies=[Depends(RequirePermission("VERIFY_BLOCKCHAIN"))]
)

@router.get("/status")
async def get_blockchain_status(
    db: AsyncSession = Depends(get_db)
):
    """
    Returns real-time Hyperledger Fabric network connectivity status,
    socket reachability, and ledger state metrics.
    """
    return await fabric_monitoring_service.check_status(db)

@router.get("/transactions")
async def list_transactions(
    verification: Optional[str] = Query(None, description="Filter by canonical verification status"),
    verification_status: Optional[str] = Query(None, description="Alias for verification status filter"),
    search: Optional[str] = Query(None, description="Search query across tx_id, record_id, operation, payload_hash"),
    page: int = Query(1, ge=1, description="1-indexed page number"),
    pageSize: Optional[int] = Query(None, ge=1, le=100, alias="pageSize", description="Items per page"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Items per page alias"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all local blockchain transaction submission logs with canonical verification states.

    Canonical verification_status values:
      - "CONFIRMED"           : Real Fabric ledger state hash matches current PostgreSQL state hash.
      - "PENDING_VERIFICATION": Awaiting ledger commit or verification evaluation.
      - "FABRIC_OFFLINE"      : Hyperledger Fabric peer gateway is currently unreachable.
      - "NOT_ANCHORED"        : Fake/synthetic TX ID (fab_tx_ prefix or UUID) or ledger record missing.
      - "TAMPERING_DETECTED"  : Cryptographic hash mismatch between PostgreSQL record and immutable ledger.
    """
    actual_page_size = pageSize or limit or 15

    query = select(BlockchainTransaction).order_by(BlockchainTransaction.created_at.desc())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (BlockchainTransaction.fabric_tx_id.ilike(term))
            | (BlockchainTransaction.operation.ilike(term))
            | (BlockchainTransaction.payload_hash.ilike(term))
            | (BlockchainTransaction.channel.ilike(term))
            | (BlockchainTransaction.chaincode.ilike(term))
            | (cast(BlockchainTransaction.record_id, String).ilike(term))
        )

    result = await db.execute(query)
    rows = result.scalars().all()

    # Ensure gateway connection state
    if not fabric_gateway.connected and fabric_gateway.configured:
        try:
            await fabric_gateway.connect()
        except Exception:
            pass
    fabric_online = fabric_gateway.connected

    # Pre-fetch allocations to compute current state hashes
    alloc_ids = [tx.record_id for tx in rows if tx.record_type == "Allocation"]
    alloc_map = {}
    if alloc_ids:
        alloc_res = await db.execute(select(Allocation).where(Allocation.id.in_(alloc_ids)))
        for a in alloc_res.scalars().all():
            alloc_map[a.id] = a

    async def evaluate_tx(tx: BlockchainTransaction) -> dict:
        is_fake_tx_id = (
            not tx.fabric_tx_id
            or tx.fabric_tx_id.startswith("fab_tx_")
            or tx.fabric_tx_id.count("-") == 4
            or len(tx.fabric_tx_id) != 64
        )

        v_status = "PENDING_VERIFICATION"
        actor_name = None

        if is_fake_tx_id:
            v_status = "NOT_ANCHORED"
        elif not fabric_online:
            v_status = "FABRIC_OFFLINE"
        else:
            # Fabric is online and transaction has a real 64-character Fabric TX ID
            if tx.record_type == "Allocation":
                alloc = alloc_map.get(tx.record_id)
                if not alloc:
                    v_status = "NOT_ANCHORED"
                else:
                    state_dict = {
                        "id": str(alloc.id),
                        "match_id": str(alloc.match_id),
                        "organ_id": str(alloc.organ_id),
                        "recipient_id": str(alloc.recipient_id),
                        "status": alloc.status,
                    }
                    computed_hash = hashlib.sha256(json.dumps(state_dict, sort_keys=True).encode("utf-8")).hexdigest()
                    try:
                        asset_str = await fabric_gateway.evaluate_transaction("GetAsset", str(tx.record_id))
                        if asset_str:
                            asset_data = json.loads(asset_str)
                            ledger_hash = asset_data.get("state_hash")
                            actor_id = asset_data.get("actor_id")
                            if actor_id:
                                actor_name = str(actor_id)
                            if computed_hash == ledger_hash:
                                v_status = "CONFIRMED"
                            else:
                                v_status = "TAMPERING_DETECTED"
                        else:
                            v_status = "NOT_ANCHORED"
                    except Exception as exc:
                        exc_msg = str(exc).lower()
                        if "unavailable" in exc_msg or "connect" in exc_msg or "connection" in exc_msg:
                            v_status = "FABRIC_OFFLINE"
                        else:
                            v_status = "NOT_ANCHORED"
            else:
                if tx.status == "CONFIRMED":
                    v_status = "CONFIRMED"
                elif tx.status == "FAILED":
                    v_status = "NOT_ANCHORED"
                else:
                    v_status = "PENDING_VERIFICATION"

        return {
            "id": str(tx.id),
            "fabric_tx_id": tx.fabric_tx_id,
            "record_id": str(tx.record_id),
            "record_type": tx.record_type,
            "operation": tx.operation,
            "payload_hash": tx.payload_hash,
            "channel": tx.channel,
            "chaincode": tx.chaincode,
            "status": tx.status,
            "created_by": str(tx.created_by),
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
            "confirmed_at": tx.confirmed_at.isoformat() if tx.confirmed_at else None,
            "block_number": None,
            "actor": actor_name,
            "previous_hash": None,
            "verification_status": v_status,
            "verification": v_status,
            "fabric_anchor_status": v_status,
        }

    enriched = await asyncio.gather(*[evaluate_tx(tx) for tx in rows])

    # Filter strictly by canonical verification status if requested
    raw_filter = (verification or verification_status or "").strip().upper()
    if raw_filter and raw_filter not in ["ALL", ""]:
        enriched = [tx for tx in enriched if tx["verification_status"] == raw_filter]

    total_count = len(enriched)
    start_idx = (page - 1) * actual_page_size
    end_idx = start_idx + actual_page_size
    paged_items = enriched[start_idx:end_idx]

    return {
        "items": paged_items,
        "total": total_count,
        "page": page,
        "pageSize": actual_page_size,
    }


@router.get("/transactions/{id}", response_model=BlockchainTransactionResponse)
async def get_transaction(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details of a single transaction log by ID.
    """
    query = select(BlockchainTransaction).where(BlockchainTransaction.id == id)
    result = await db.execute(query)
    tx = result.scalars().first()

    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction record not found."
        )

    return tx

@router.post("/verify-tx")
async def verify_blockchain_tx(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify Hyperledger Fabric blockchain transaction anchor against the active PostgreSQL database record.
    Recomputes the cryptographic state hash from current database state and compares against
    the immutable ledger anchor retrieved directly from Fabric to detect database tampering.

    ARCHITECTURE:
      computed_hash  = SHA-256(current PostgreSQL allocation fields)
      fabric_hash    = GetAsset(allocation_id).state_hash  [from Fabric ledger — immutable]
      is_valid       = computed_hash == fabric_hash

    The trusted hash is ALWAYS fetched from the real Fabric ledger.
    blockchain_transactions.payload_hash is a local submission log only, NOT the verification source.
    """
    target_id = payload.get("fabric_tx_id") or payload.get("tx_id") or payload.get("record_id")
    if not target_id:
        raise HTTPException(status_code=400, detail="Transaction ID (fabric_tx_id) or Record ID (record_id) is required.")

    # 1. Resolve BlockchainTransaction anchor record
    tx_obj = None
    target_uuid = None
    try:
        target_uuid = uuid.UUID(str(target_id))
    except (ValueError, AttributeError):
        pass

    # Search by fabric_tx_id
    q = select(BlockchainTransaction).where(BlockchainTransaction.fabric_tx_id == str(target_id))
    res = await db.execute(q)
    tx_obj = res.scalars().first()

    # Search by id or record_id if target_id is a valid UUID
    if not tx_obj and target_uuid:
        q2 = select(BlockchainTransaction).where(
            (BlockchainTransaction.id == target_uuid) | (BlockchainTransaction.record_id == target_uuid)
        )
        res2 = await db.execute(q2)
        tx_obj = res2.scalars().first()

    # If still not found, check if target_uuid is an Allocation with an assigned fabric_tx_id
    if not tx_obj and target_uuid:
        alloc_q = select(Allocation).where(Allocation.id == target_uuid)
        alloc_res = await db.execute(alloc_q)
        existing_alloc = alloc_res.scalars().first()
        if existing_alloc and existing_alloc.fabric_tx_id:
            q3 = select(BlockchainTransaction).where(BlockchainTransaction.fabric_tx_id == existing_alloc.fabric_tx_id)
            res3 = await db.execute(q3)
            tx_obj = res3.scalars().first()

        if not tx_obj and existing_alloc:
            return {
                "status": "NOT_FOUND",
                "is_valid": False,
                "verification_result": "LEDGER_RECORD_MISSING",
                "record_id": str(existing_alloc.id),
                "record_type": "Allocation",
                "details": "Record exists in PostgreSQL, but has not been anchored to the Hyperledger Fabric ledger.",
                "message": "Blockchain transaction record not found.",
            }

    if not tx_obj:
        return {
            "status": "NOT_FOUND",
            "is_valid": False,
            "verification_result": "NOT_FOUND",
            "details": "Hyperledger Fabric transaction record not found in ledger database.",
            "message": "Transaction record not found.",
        }

    # 2. REQUIRE Fabric connection — trusted hash MUST come from the immutable ledger, never from PostgreSQL.
    #    blockchain_transactions.payload_hash is a local submission log only and is NOT the authority.
    if not fabric_gateway.connected:
        await fabric_gateway.connect()

    if not fabric_gateway.connected:
        return {
            "status": "FABRIC_OFFLINE",
            "is_valid": False,
            "verification_result": "FABRIC_OFFLINE",
            "fabric_tx_id": tx_obj.fabric_tx_id,
            "record_id": str(tx_obj.record_id),
            "record_type": tx_obj.record_type,
            "details": (
                "Hyperledger Fabric peer is not reachable. "
                "Integrity verification requires a live connection to the immutable ledger. "
                "The trusted hash cannot be sourced from the local database — that would not detect tampering."
            ),
            "channel": tx_obj.channel,
            "chaincode": tx_obj.chaincode,
            "confirmed_at": tx_obj.confirmed_at.isoformat() if tx_obj.confirmed_at else None,
        }

    # 3. Fetch the trusted anchor hash from the REAL Fabric ledger.
    #    This is the only authoritative source. If the record is not on the ledger, verification fails.
    fabric_state_hash = None
    fabric_actor_id = None
    fabric_actor_name = None
    fabric_organization = None
    fabric_timestamp = None
    try:
        asset_str = await fabric_gateway.evaluate_transaction("GetAsset", str(tx_obj.record_id))
        if asset_str:
            asset_data = json.loads(asset_str)
            if isinstance(asset_data, dict):
                fabric_state_hash = asset_data.get("state_hash")
                fabric_actor_id = asset_data.get("actor_id")  # UUID of the approving user
                fabric_organization = asset_data.get("organization")
                # Fabric timestamp is Unix seconds (int64 from GetTxTimestamp)
                ts_seconds = asset_data.get("timestamp")
                if ts_seconds:
                    from datetime import datetime, timezone
                    fabric_timestamp = datetime.fromtimestamp(ts_seconds, tz=timezone.utc).isoformat()
    except Exception as e:
        logger.error(f"Fabric GetAsset failed for record {tx_obj.record_id}: {e}")

    # Resolve actor UUID → username if possible
    if fabric_actor_id:
        try:
            from app.models.user import User
            actor_uuid = uuid.UUID(str(fabric_actor_id))
            actor_res = await db.execute(select(User).where(User.id == actor_uuid))
            actor_user = actor_res.scalars().first()
            if actor_user:
                fabric_actor_name = actor_user.username or str(fabric_actor_id)
            else:
                fabric_actor_name = str(fabric_actor_id)  # unknown user — show UUID
        except Exception:
            fabric_actor_name = str(fabric_actor_id)  # show raw UUID if lookup fails

    if not fabric_state_hash:
        return {
            "status": "LEDGER_RECORD_MISSING",
            "is_valid": False,
            "verification_result": "LEDGER_RECORD_MISSING",
            "fabric_tx_id": tx_obj.fabric_tx_id,
            "record_id": str(tx_obj.record_id),
            "record_type": tx_obj.record_type,
            "details": (
                f"Fabric ledger has no anchored asset for record {tx_obj.record_id}. "
                "The record may not have been committed to the ledger, or the Fabric TX ID is invalid."
            ),
            "channel": tx_obj.channel,
            "chaincode": tx_obj.chaincode,
            "confirmed_at": tx_obj.confirmed_at.isoformat() if tx_obj.confirmed_at else None,
        }

    # 4. Compute active state hash from current PostgreSQL record to detect tampering
    computed_hash = None
    if tx_obj.record_type == "Allocation":
        alloc_q = select(Allocation).where(Allocation.id == tx_obj.record_id)
        alloc_res = await db.execute(alloc_q)
        allocation = alloc_res.scalars().first()

        if not allocation:
            return {
                "status": "RECORD_NOT_FOUND",
                "is_valid": False,
                "fabric_tx_id": tx_obj.fabric_tx_id,
                "record_id": str(tx_obj.record_id),
                "record_type": tx_obj.record_type,
                "fabric_state_hash": fabric_state_hash,
                "computed_hash": None,
                "verification_result": "RECORD_NOT_FOUND",
                "details": f"Anchored Allocation record {tx_obj.record_id} does not exist in PostgreSQL database.",
            }

        state_dict = {
            "id": str(allocation.id),
            "match_id": str(allocation.match_id),
            "organ_id": str(allocation.organ_id),
            "recipient_id": str(allocation.recipient_id),
            "status": allocation.status,
        }
        computed_hash = hashlib.sha256(json.dumps(state_dict, sort_keys=True).encode("utf-8")).hexdigest()
    else:
        # For non-Allocation record types: cannot recompute, report as unverifiable
        return {
            "status": "UNSUPPORTED_RECORD_TYPE",
            "is_valid": False,
            "verification_result": "UNSUPPORTED_RECORD_TYPE",
            "fabric_tx_id": tx_obj.fabric_tx_id,
            "record_id": str(tx_obj.record_id),
            "record_type": tx_obj.record_type,
            "details": f"Hash recomputation is not implemented for record type '{tx_obj.record_type}'.",
        }

    # 5. Compare current DB-derived hash against the REAL immutable Fabric ledger hash
    is_valid = (computed_hash == fabric_state_hash)

    if is_valid:
        verification_result = "VERIFIED"
        verification_status = "VERIFIED"
        details = (
            "Ledger verification successful. Current database state hash matches the immutable "
            "Hyperledger Fabric ledger anchor. No tampering detected."
        )
    else:
        verification_result = "TAMPERING_DETECTED"
        verification_status = "TAMPERED"
        details = (
            f"TAMPERING DETECTED. Cryptographic hash mismatch: "
            f"current database state hash ({computed_hash}) does not match "
            f"the immutable Fabric ledger anchor ({fabric_state_hash}). "
            f"The PostgreSQL record has been altered after ledger anchoring."
        )

    return {
        "status": verification_status,
        "is_valid": is_valid,
        "fabric_tx_id": tx_obj.fabric_tx_id,
        "record_id": str(tx_obj.record_id),
        "record_type": tx_obj.record_type,
        "operation": tx_obj.operation,
        "fabric_state_hash": fabric_state_hash,
        "stored_hash": fabric_state_hash,      # kept for UI back-compat
        "payload_hash": fabric_state_hash,     # kept for UI back-compat
        "computed_hash": computed_hash,
        "channel": tx_obj.channel,
        "chaincode": tx_obj.chaincode,
        "fabric_queried": True,
        "fabric_anchor_status": verification_result,
        # Block number: UNAVAILABLE — moe-fabric-gateway does not expose qscc/ledger-info
        "block_number": None,
        # Actor from real Fabric AssetHash (not "System" — real actor_id resolved to username)
        "actor": fabric_actor_name,
        "actor_id": fabric_actor_id,
        "organization": fabric_organization,
        # Fabric transaction timestamp (from GetTxTimestamp in chaincode, not application time)
        "fabric_timestamp": fabric_timestamp,
        # Previous hash: UNAVAILABLE — requires gRPC qscc block header query
        "previous_hash": None,
        "confirmed_at": tx_obj.confirmed_at.isoformat() if tx_obj.confirmed_at else None,
        "verification_result": verification_result,
        "details": details,
    }
