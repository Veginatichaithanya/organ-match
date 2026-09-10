import os
import socket
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.models.blockchain_transaction import BlockchainTransaction
from app.blockchain.fabric_gateway import fabric_gateway

logger = logging.getLogger("fabric_monitoring")

class FabricMonitoringService:
    """
    Real-time Hyperledger Fabric ledger & network connectivity monitoring service.
    Evaluates certificate configuration, socket reachability to peer nodes,
    gateway state, and transaction commit counters without exposing secrets.
    """

    async def check_status(self, db: Optional[AsyncSession] = None) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)

        # 1. Inspect configuration
        is_configured = fabric_gateway.configured
        network_name = fabric_gateway.network or "organmatch"
        channel_name = fabric_gateway.channel or "organ-donation-channel"
        chaincode_name = fabric_gateway.chaincode or "organ-contract"
        peer_endpoint = os.getenv("FABRIC_PEER_ENDPOINT", "localhost:7051")
        orderer_endpoint = os.getenv("FABRIC_ORDERER_ENDPOINT", "localhost:7050")

        logger.info(f"[MONITORING] Starting Fabric network probe. Configured: {is_configured}, Peer: {peer_endpoint}")

        def _probe_socket(endpoint: str, timeout: float = 1.0) -> bool:
            if not endpoint or ":" not in endpoint:
                return False
            host, port_str = endpoint.split(":", 1)
            try:
                port = int(port_str)
                target_ip = "127.0.0.1" if host in ["localhost", "127.0.0.1"] else host
                with socket.create_connection((target_ip, port), timeout=timeout):
                    return True
            except Exception:
                return False

        # Run socket probes in thread pool to avoid blocking the async event loop
        import asyncio
        peer_reachable, orderer_reachable = await asyncio.gather(
            asyncio.to_thread(_probe_socket, peer_endpoint, 1.0),
            asyncio.to_thread(_probe_socket, orderer_endpoint, 1.0),
            return_exceptions=True
        )
        peer_reachable = bool(peer_reachable) if not isinstance(peer_reachable, Exception) else False
        orderer_reachable = bool(orderer_reachable) if not isinstance(orderer_reachable, Exception) else False

        peer_error_reason = ""
        if not peer_reachable:
            peer_error_reason = f"peer endpoint ({peer_endpoint}) is unreachable"

        # 4. Attempt Gateway connection if configured
        if is_configured and not fabric_gateway.connected and peer_reachable:
            await fabric_gateway.connect()

        is_connected = fabric_gateway.connected

        # 5. Transaction & ledger metrics from PostgreSQL blockchain_transactions table
        tx_count = 0
        failed_count = 0
        db_max_block = 0
        last_tx_time = None

        if db is not None:
            try:
                res = await db.execute(select(func.count(BlockchainTransaction.id)))
                tx_count = res.scalar() or 0

                f_res = await db.execute(
                    select(func.count(BlockchainTransaction.id))
                    .where(BlockchainTransaction.status == "FAILED")
                )
                failed_count = f_res.scalar() or 0

                # NOTE: blockchain_transactions table does NOT have a block_number column.
                # Block numbers come from the Fabric ledger directly, not from our local DB.
                # db_max_block stays 0 (unused).

                last_res = await db.execute(
                    select(BlockchainTransaction.created_at)
                    .order_by(BlockchainTransaction.created_at.desc())
                    .limit(1)
                )
                last_tx_time = last_res.scalar()
            except Exception as exc:
                logger.debug(f"DB metric lookup skipped: {exc}")

        # 6. Determine dynamic status
        is_live_network = False
        latest_block = None
        # Never fabricate block numbers. last_known_block is only set when actually
        # retrieved from the real Fabric ledger — never hardcoded.
        last_known_block = None
        last_synced_at = last_tx_time

        if not is_configured:
            status = "NOT_CONFIGURED"
            message = "Fabric network certificates or keystore configuration is not present"
            peer_status = "NOT_CONFIGURED"
            orderer_status = "NOT_CONFIGURED"
            chaincode_status = "NOT_CONFIGURED"
            is_live_network = False
            latest_block = None
        elif is_connected and peer_reachable:
            status = "HEALTHY"
            message = f"Fabric gateway connected to channel '{channel_name}' on peer {peer_endpoint}"
            peer_status = "CONNECTED"
            orderer_status = "CONNECTED" if orderer_reachable else "AVAILABLE"
            chaincode_status = "AVAILABLE"
            is_live_network = True
            # get_latest_block_height returns None when ledger-info query unavailable
            latest_block = fabric_gateway.get_latest_block_height()
            last_known_block = latest_block  # None means UNAVAILABLE, which is honest
        elif peer_reachable:
            status = "DEGRADED"
            message = f"Fabric peer reachable at {peer_endpoint}, but gateway authentication is pending"
            peer_status = "CONNECTED"
            orderer_status = "CONNECTED" if orderer_reachable else "DISCONNECTED"
            chaincode_status = "AVAILABLE"
            is_live_network = False
            latest_block = None
        else:
            status = "OFFLINE"
            message = (
                f"Fabric network is configured (certs present), but the peer node at "
                f"{peer_endpoint} is not running. Start the Fabric test-network to enable blockchain features."
                if peer_error_reason
                else f"Fabric network is configured, but peer endpoint ({peer_endpoint}) cannot currently be reached"
            )
            peer_status = "DISCONNECTED"
            orderer_status = "DISCONNECTED"
            chaincode_status = "UNAVAILABLE"
            is_live_network = False
            latest_block = None

        logger.info(
            f"[MONITORING] Fabric check complete — Status: {status}, Peer: {peer_status}, "
            f"Live: {is_live_network}, Last Known Block: {last_known_block}"
        )

        return {
            "service": "hyperledger_fabric",
            "status": status,
            "message": message,
            "configured": is_configured,
            "network_reachable": peer_reachable or is_connected,
            "is_live_network": is_live_network,
            "peer_status": peer_status,
            "orderer_status": orderer_status,
            "peer_endpoint": peer_endpoint,
            "orderer_endpoint": orderer_endpoint,
            "network": network_name,
            "channel": channel_name,
            "chaincode": chaincode_name,
            "chaincode_status": chaincode_status,
            "latest_block": latest_block,
            "last_known_block": last_known_block,
            "last_synced_at": last_synced_at,
            "transaction_count": tx_count,
            "local_transaction_count": tx_count,
            "failed_transactions": failed_count,
            "last_successful_tx": last_tx_time,
            "checked_at": now_utc,
        }

fabric_monitoring_service = FabricMonitoringService()
