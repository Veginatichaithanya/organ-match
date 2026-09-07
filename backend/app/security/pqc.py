import time
import random
from typing import Dict, Any, List

class PQCService:
    """
    Simulates NIST Round 3 Post-Quantum Cryptography (PQC) algorithm metrics.
    Compares key sizes, signature overhead, encapsulation/decapsulation latency,
    and sign/verify performance between classical (RSA, ECC) and quantum-safe (Kyber, Dilithium) schemes.
    """

    @staticmethod
    def get_metrics() -> List[Dict[str, Any]]:
        """
        Returns real-world baseline comparison metrics for classical vs post-quantum algorithms.
        """
        return [
            {
                "algorithm": "RSA-2048 (Classical)",
                "type": "Signature",
                "key_size_bytes": 256,
                "signature_size_bytes": 256,
                "latency_ms": 1.24,
                "security_level": "Pre-Quantum (112-bit security)",
                "overhead_multiplier": 1.0
            },
            {
                "algorithm": "ECDSA-P256 (Classical)",
                "type": "Signature",
                "key_size_bytes": 32,
                "signature_size_bytes": 64,
                "latency_ms": 0.35,
                "security_level": "Pre-Quantum (128-bit security)",
                "overhead_multiplier": 1.0
            },
            {
                "algorithm": "CRYSTALS-Kyber-768 (PQC)",
                "type": "KEM (Key Exchange)",
                "key_size_bytes": 1184,
                "signature_size_bytes": 1088, # Ciphertext size
                "latency_ms": 0.05,
                "security_level": "NIST Category 3 (AES-192 equivalent)",
                "overhead_multiplier": 37.0
            },
            {
                "algorithm": "CRYSTALS-Dilithium3 (PQC)",
                "type": "Signature",
                "key_size_bytes": 1952,
                "signature_size_bytes": 3293,
                "latency_ms": 0.08,
                "security_level": "NIST Category 3 (AES-192 equivalent)",
                "overhead_multiplier": 51.4
            },
            {
                "algorithm": "Falcon-512 (PQC)",
                "type": "Signature",
                "key_size_bytes": 897,
                "signature_size_bytes": 666,
                "latency_ms": 0.28,
                "security_level": "NIST Category 1 (AES-128 equivalent)",
                "overhead_multiplier": 10.4
            }
        ]

    @classmethod
    def simulate_pqc_handshake(cls, algorithm: str = "CRYSTALS-Kyber-768") -> Dict[str, Any]:
        """
        Simulates an active PQC key exchange, calculating random latency variation
        to represent live client transactions.
        """
        metrics_db = {m["algorithm"]: m for m in cls.get_metrics()}
        target = metrics_db.get(algorithm) or metrics_db["CRYSTALS-Kyber-768 (PQC)"]
        
        # Add slight jitter to simulate network transmission
        jitter = random.uniform(-0.01, 0.02)
        elapsed_time = max(0.01, target["latency_ms"] + jitter)

        return {
            "algorithm": algorithm,
            "handshake_type": target["type"],
            "key_size_bytes": target["key_size_bytes"],
            "payload_size_bytes": target["signature_size_bytes"],
            "execution_time_ms": round(elapsed_time, 3),
            "security_level": target["security_level"],
            "status": "SECURE_PQC_COMMUNICATION"
        }
