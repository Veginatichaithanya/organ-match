import os
import logging
import json
import asyncio
from typing import Optional, List, Dict, Any

from moe_fabric_gateway import (
    Gateway,
    GatewayClient,
    TLSConfig,
    X509Identity,
    EcdsaSigner
)
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Configure logger
logger = logging.getLogger("blockchain_gateway")

class FabricGateway:
    """
    Core Hyperledger Fabric Gateway client using moe-fabric-gateway.
    Handles network connections, transaction submissions (endorsement, ordering, committing),
    ledger queries, and verification checks.
    """
    def __init__(self):
        self.connected = False
        self._gateway_client = None
        self._identity = None
        self._signer = None

    def _refresh_env(self):
        try:
            from dotenv import dotenv_values
            backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
            if os.path.exists(backend_env):
                vals = dotenv_values(backend_env)
                for k, v in vals.items():
                    if v:
                        os.environ[k] = v
            root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")
            if os.path.exists(root_env):
                vals = dotenv_values(root_env)
                for k, v in vals.items():
                    if v and k not in os.environ:
                        os.environ[k] = v
        except Exception:
            pass

    @property
    def cert_path(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_CERT_PATH", "")

    @property
    def key_path(self) -> str:
        self._refresh_env()
        path = os.getenv("FABRIC_KEY_PATH", "")
        if path and not os.path.exists(path):
            # The filename changes when network restarts. Try to find the new key in the directory.
            key_dir = os.path.dirname(path)
            if os.path.exists(key_dir):
                for file in os.listdir(key_dir):
                    if file.endswith("_sk"):
                        return os.path.join(key_dir, file)
        return path

    @property
    def tls_cert_path(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_TLS_CERT_PATH", "")

    @property
    def peer_endpoint(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_PEER_ENDPOINT", "localhost:7051")

    @property
    def msp_id(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_MSP_ID", "Org1MSP")

    @property
    def network(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_NETWORK", "organ-donation-network")

    @property
    def channel(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_CHANNEL", "organ-donation-channel")

    @property
    def chaincode(self) -> str:
        self._refresh_env()
        return os.getenv("FABRIC_CHAINCODE", "organ-contract")

    @property
    def configured(self) -> bool:
        c_path = self.cert_path
        k_path = self.key_path
        return bool(c_path and k_path and os.path.exists(c_path) and os.path.exists(k_path))

    async def connect(self) -> bool:
        """
        Loads certificates and establishes a connection to the Fabric Peer nodes.
        """
        if not self.configured:
            logger.info(
                "Hyperledger Fabric CA certificates or private keys are not configured. "
                "Gateway operating in NOT_CONFIGURED state."
            )
            self.connected = False
            return False

        try:
            # Read certificate
            with open(self.cert_path, "rb") as f:
                cert_pem = f.read()
            self._identity = X509Identity(msp_id=self.msp_id, certificate_pem=cert_pem)
            
            # Read and parse private key
            with open(self.key_path, "rb") as f:
                key_pem = f.read()
            private_key = serialization.load_pem_private_key(
                key_pem,
                password=None,
                backend=default_backend()
            )
            self._signer = EcdsaSigner(private_key=private_key)

            # Create gRPC Gateway Client
            tls_config = None
            if self.tls_cert_path and os.path.exists(self.tls_cert_path):
                with open(self.tls_cert_path, "rb") as f:
                    tls_ca_cert = f.read()
                tls_config = TLSConfig(ca_cert=tls_ca_cert)
            
            self._gateway_client = GatewayClient(
                target=self.peer_endpoint, 
                tls_config=tls_config
            )
            
            logger.info("Successfully connected to Hyperledger Fabric peer gateway.")
            self.connected = True
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Hyperledger Fabric peer network: {str(e)}")
            self.connected = False
            return False

    def get_latest_block_height(self, db_max_block: int = 0) -> Optional[int]:
        """
        Returns the latest known block height from Fabric.

        NOTE: The moe-fabric-gateway library does not expose a qscc/ledger-info
        query in its current API surface. Block height therefore CANNOT be retrieved
        reliably via this gateway. Returns None (UNAVAILABLE) rather than fabricating
        a value such as 1042.

        If a real block height is required in future, implement a gRPC qscc query
        against GetChainInfo or integrate fabric-network's channel.queryInfo().
        """
        if not self.connected:
            return None
        # Real ledger-info query not available via moe-fabric-gateway API.
        # Return None so callers display UNAVAILABLE instead of a fake number.
        logger.debug(
            "Block height query requested but not retrievable via current gateway API. "
            "Returning None (UNAVAILABLE)."
        )
        return None

    def _create_gateway_client(self) -> GatewayClient:
        tls_config = None
        if self.tls_cert_path and os.path.exists(self.tls_cert_path):
            with open(self.tls_cert_path, "rb") as f:
                tls_ca_cert = f.read()
            tls_config = TLSConfig(ca_cert=tls_ca_cert)
        
        return GatewayClient(
            target=self.peer_endpoint, 
            tls_config=tls_config
        )

    async def submit_transaction(self, function_name: str, *args: str) -> Optional[str]:
        """
        Invokes a write transaction on the smart contract. Requires endorsement and ordering.
        Returns the committed Transaction ID (tx_id) or None if Fabric is offline.
        """
        if not self.connected or not self._identity or not self._signer:
            logger.warning(
                f"Fabric transaction submission skipped. Gateway connected=False, configured={self.configured}. "
                f"Function: {function_name}"
            )
            return None

        client = self._create_gateway_client()
        try:
            async with Gateway(client, self._identity, self._signer) as gateway:
                network = gateway.get_network(self.channel)
                contract = network.get_contract(self.chaincode)
                
                result_bytes = await contract.submit_transaction(function_name, *args)
                # moe-fabric-gateway returns the transaction ID as bytes
                return result_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Fabric transaction submission failed for '{function_name}': {str(e)}")
            raise RuntimeError(f"Blockchain commit failed: {str(e)}")

    async def evaluate_transaction(self, function_name: str, *args: str) -> Optional[str]:
        """
        Invokes a read-only query on the ledger. Does not require consensus.
        """
        if not self.connected or not self._identity or not self._signer:
            logger.warning(f"Fabric ledger query skipped. Gateway offline. Function: {function_name}")
            return None

        client = self._create_gateway_client()
        try:
            async with Gateway(client, self._identity, self._signer) as gateway:
                network = gateway.get_network(self.channel)
                contract = network.get_contract(self.chaincode)
                
                result_bytes = await contract.evaluate_transaction(function_name, *args)
                return result_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Fabric ledger evaluation failed for '{function_name}': {str(e)}")
            raise RuntimeError(f"Blockchain query failed: {str(e)}")

    async def verify_transaction(self, record_id: str, current_hash: str) -> bool:
        """
        Invokes the chaincode's 'VerifyRecordHash' to assert if PostgreSQL hash matches
        the immutable ledger anchor.
        """
        if not self.connected:
            return False
            
        try:
            res_str = await self.evaluate_transaction("VerifyRecordHash", record_id, current_hash)
            return res_str == "true"
        except Exception:
            return False

    async def get_transaction_history(self, record_id: str) -> List[Dict[str, Any]]:
        """
        Invokes the chaincode's 'GetAssetHistory' to retrieve full block revision log.
        """
        if not self.connected:
            return []

        try:
            history_str = await self.evaluate_transaction("GetAssetHistory", record_id)
            if history_str:
                return json.loads(history_str)
            return []
        except Exception as e:
            logger.error(f"Failed to query ledger history for record {record_id}: {str(e)}")
            return []

    async def disconnect(self):
        """Cleans up gateway connections."""
        self.connected = False
        if self._gateway_client:
            # If the client has a close method, call it
            if hasattr(self._gateway_client, 'close'):
                await getattr(self._gateway_client, 'close')()
            elif hasattr(self._gateway_client, '_channel'):
                await getattr(self._gateway_client._channel, 'close')()

# Instantiate single global gateway manager
fabric_gateway = FabricGateway()
