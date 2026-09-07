"""
Post-Quantum Key Management Service
Stores ML-KEM-768 key pairs securely outside source control.
Private keys are NEVER exposed via API responses or logs.
"""
import os
import stat
import logging
from typing import Optional, Tuple
from app.security.pqc.kem import generate_keypair, ALGORITHM_NAME

logger = logging.getLogger("pqc_key_manager")

class PQCKeyManager:
    def __init__(self):
        self.key_dir = os.getenv("PQC_KEY_DIRECTORY", ".pqc_keys")
        self.pub_key_file = "ml_kem_768_public.key"
        self.priv_key_file = "ml_kem_768_private.key"

    def get_key_dir_path(self) -> str:
        if os.path.isabs(self.key_dir):
            return self.key_dir
        base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        return os.path.join(base, self.key_dir)

    def ensure_key_directory(self) -> str:
        dir_path = self.get_key_dir_path()
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, mode=0o700, exist_ok=True)
        return dir_path

    def get_public_key_path(self) -> str:
        return os.path.join(self.ensure_key_directory(), self.pub_key_file)

    def get_private_key_path(self) -> str:
        return os.path.join(self.ensure_key_directory(), self.priv_key_file)

    def has_valid_keypair(self) -> bool:
        pub_p = self.get_public_key_path()
        priv_p = self.get_private_key_path()
        if os.path.exists(pub_p) and os.path.exists(priv_p):
            try:
                with open(pub_p, "rb") as f:
                    pk = f.read()
                with open(priv_p, "rb") as f:
                    sk = f.read()
                return len(pk) == 1184 and len(sk) == 2400
            except Exception:
                return False
        return False

    def ensure_keypair(self) -> Tuple[bytes, bytes]:
        """
        Loads existing ML-KEM-768 keypair or generates a new pair if missing.
        """
        if self.has_valid_keypair():
            with open(self.get_public_key_path(), "rb") as f:
                pk = f.read()
            with open(self.get_private_key_path(), "rb") as f:
                sk = f.read()
            return pk, sk

        # Generate new pair
        pk, sk = generate_keypair()
        pub_p = self.get_public_key_path()
        priv_p = self.get_private_key_path()

        with open(pub_p, "wb") as f:
            f.write(pk)

        with open(priv_p, "wb") as f:
            f.write(sk)

        # Set restrictive permissions on private key file (0600)
        try:
            if hasattr(stat, "S_IRUSR") and hasattr(stat, "S_IWUSR"):
                os.chmod(priv_p, stat.S_IRUSR | stat.S_IWUSR)
        except Exception:
            pass

        logger.info(f"Generated and stored new {ALGORITHM_NAME} keypair in {self.get_key_dir_path()}")
        return pk, sk

    def get_public_key(self) -> Optional[bytes]:
        if not self.has_valid_keypair():
            self.ensure_keypair()
        try:
            with open(self.get_public_key_path(), "rb") as f:
                return f.read()
        except Exception:
            return None

    def get_private_key(self) -> Optional[bytes]:
        """Internal service getter only. NEVER return this via API."""
        if not self.has_valid_keypair():
            self.ensure_keypair()
        try:
            with open(self.get_private_key_path(), "rb") as f:
                return f.read()
        except Exception:
            return None

pqc_key_manager = PQCKeyManager()
