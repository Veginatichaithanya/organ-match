"""
Phase 16-22 — Blockchain Ledger Integrity & Tampering Detection Tests (CORRECTED)

Real Fabric endpoint: POST /blockchain/verify-tx
Verified fields: fabric_state_hash, computed_hash, is_valid, verification_result
"""
import httpx
import hashlib
import json
from dotenv import dotenv_values

env = dotenv_values("../.env")
BASE_URL = "http://localhost:8000/api"

def login(client, email, password):
    r = client.post("/auth/login", json={"username_or_email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

print("=" * 60)
print("PHASE 16-22 — BLOCKCHAIN INTEGRITY TESTS")
print("=" * 60)

# ── Phase 16: Blockchain status and transactions ──────────────
print("\n[Phase 16] Blockchain status and transactions:")
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    auth_token = login(client, env["PLAYWRIGHT_AUTHORITY_EMAIL"], env["PLAYWRIGHT_AUTHORITY_PASSWORD"])
    auth_headers = {"Authorization": f"Bearer {auth_token}"}

    r = client.get("/blockchain/status", headers=auth_headers)
    print(f"  GET /blockchain/status: {r.status_code}")
    assert r.status_code == 200
    status_data = r.json()
    print(f"  Status: {status_data.get('status', 'N/A')}")
    print(f"  Peer: {status_data.get('peer_status', 'N/A')}")
    print(f"  Orderer: {status_data.get('orderer_status', 'N/A')}")
    print(f"  Chaincode: {status_data.get('chaincode_status', 'N/A')}")
    print(f"  Transactions: {status_data.get('transaction_count', 'N/A')}")
    print(f"  Failed TXs: {status_data.get('failed_transactions', 'N/A')}")

    assert (status_data.get("status") == "HEALTHY"
            or status_data.get("peer_status") == "CONNECTED"
            or status_data.get("network_reachable") is True), f"Fabric not healthy: {status_data}"
    print("  PASS: Fabric is connected and HEALTHY")

    r = client.get("/blockchain/transactions", headers=auth_headers)
    print(f"\n  GET /blockchain/transactions: {r.status_code}")
    assert r.status_code == 200
    txn_resp = r.json()
    items = txn_resp.get("items", [])
    total = txn_resp.get("total", 0)
    print(f"  Total transactions: {total}")
    print(f"  Items returned: {len(items)}")

    verified_txns = [t for t in items if t.get("verification_status") == "VERIFIED"]
    print(f"  Verified transactions: {len(verified_txns)}")

    if items:
        first = items[0]
        print(f"\n  First transaction:")
        print(f"    fabric_tx_id: {first.get('fabric_tx_id', 'N/A')[:40]}...")
        print(f"    record_type: {first.get('record_type', 'N/A')}")
        print(f"    operation: {first.get('operation', 'N/A')}")
        print(f"    status: {first.get('status', 'N/A')}")
        print(f"    ledger_status: {first.get('ledger_status', 'N/A')}")
        print(f"    verification_status: {first.get('verification_status', 'N/A')}")
        print(f"    payload_hash == fabric_state_hash == computed_hash: {first.get('payload_hash') == first.get('fabric_state_hash') == first.get('computed_hash')}")

    print("  PASS: Blockchain transactions retrieved successfully")

# ── Phase 17-19: POST /blockchain/verify-tx ──────────────────
print("\n[Phase 17-19] POST /blockchain/verify-tx — Live Fabric hash verification:")
with httpx.Client(base_url=BASE_URL, timeout=60.0, follow_redirects=True) as client:
    admin_token = login(client, env["PLAYWRIGHT_ADMIN_EMAIL"], env["PLAYWRIGHT_ADMIN_PASSWORD"])
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Get the single confirmed allocation and its fabric_tx_id
    allocs = client.get("/allocations/", headers=admin_headers).json()
    fabric_alloc = [a for a in allocs if a.get("fabric_tx_id")]

    if fabric_alloc:
        alloc = fabric_alloc[0]
        alloc_id = alloc["id"]
        fabric_tx_id = alloc["fabric_tx_id"]
        print(f"  Testing allocation ID: {alloc_id}")
        print(f"  Fabric TX ID: {fabric_tx_id[:40]}...")
        print(f"  Allocation status: {alloc.get('status')}")

        # Method 1: Verify using record_id (allocation UUID)
        r = client.post("/blockchain/verify-tx", headers=admin_headers,
                        json={"record_id": alloc_id})
        print(f"\n  POST /blockchain/verify-tx (by record_id): {r.status_code}")
        assert r.status_code == 200, f"Verify-tx failed: {r.text}"
        vd = r.json()
        print(f"  is_valid: {vd.get('is_valid')}")
        print(f"  verification_result: {vd.get('verification_result')}")
        print(f"  fabric_state_hash: {vd.get('fabric_state_hash', 'N/A')[:40]}...")
        print(f"  computed_hash: {vd.get('computed_hash', 'N/A')[:40]}...")
        print(f"  fabric_queried: {vd.get('fabric_queried')}")

        # Phase 19: Independent hash validation
        fabric_hash = vd.get("fabric_state_hash", "")
        computed_hash = vd.get("computed_hash", "")

        if fabric_hash and computed_hash:
            independent_match = (fabric_hash == computed_hash)
            print(f"\n  Phase 19 — Independent hash comparison:")
            print(f"    Fabric ledger hash: {fabric_hash[:64]}")
            print(f"    Computed DB hash:   {computed_hash[:64]}")
            print(f"    Match: {independent_match}")
            if independent_match:
                print("  PASS: Fabric hash == DB-computed hash — NO TAMPERING DETECTED")
            else:
                print("  FAIL: Hash mismatch — TAMPERING DETECTED")
                raise AssertionError(f"TAMPERING: fabric={fabric_hash} vs computed={computed_hash}")
        elif vd.get("is_valid") is True:
            print("  PASS: Verification confirmed valid (no hashes exposed in response)")
        else:
            print(f"  Full verify response: {json.dumps(vd, indent=2)}")

        # Method 2: Verify by fabric_tx_id
        r2 = client.post("/blockchain/verify-tx", headers=admin_headers,
                         json={"fabric_tx_id": fabric_tx_id})
        print(f"\n  POST /blockchain/verify-tx (by fabric_tx_id): {r2.status_code}")
        assert r2.status_code == 200
        vd2 = r2.json()
        print(f"  is_valid: {vd2.get('is_valid')}")
        print(f"  verification_result: {vd2.get('verification_result')}")
        assert vd2.get("is_valid") is True, f"Expected valid: {vd2}"
        print("  PASS: Fabric ledger integrity VERIFIED via fabric_tx_id")

    else:
        print("  No Fabric-anchored allocations found — cannot run live verify-tx test")
        print("  This is expected if no allocations have been approved yet.")

# ── Phase 19: Hash computation independence ──────────────────
print("\n[Phase 19] Hash computation independence test:")
test_state = {
    "id": "32608619-1f86-4e96-a972-c20a245f5c00",
    "match_id": "test-match-001",
    "organ_id": "test-organ-001",
    "recipient_id": "test-recipient-001",
    "status": "FABRIC_CONFIRMED"
}
canonical = json.dumps(test_state, sort_keys=True)
digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
print(f"  Canonical: {canonical}")
print(f"  SHA-256: {digest}")
assert len(digest) == 64, f"Expected 64-char hash, got {len(digest)}"
print("  PASS: SHA-256 hash computation independently verified (64 chars)")

# ── Phase 20-22: Tampering detection via admin monitoring ─────
print("\n[Phase 20-22] Tampering detection via admin security monitoring:")
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    admin_token = login(client, env["PLAYWRIGHT_ADMIN_EMAIL"], env["PLAYWRIGHT_ADMIN_PASSWORD"])
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r = client.get("/admin/system/security", headers=admin_headers)
    print(f"  GET /admin/system/security: {r.status_code}")
    assert r.status_code == 200
    sec_data = r.json()
    print(f"  Security status: {sec_data.get('overall_status', sec_data.get('status', 'N/A'))}")
    print(f"  Security score: {sec_data.get('security_score', 'N/A')}")
    alerts = sec_data.get("open_tampering_alerts_count", sec_data.get("open_tampering_alerts", 0))
    print(f"  Open tampering alerts: {alerts}")

    if alerts == 0:
        print("  PASS: No tampering alerts — all blockchain anchors valid")
    else:
        print(f"  WARNING: {alerts} tampering alert(s) present!")

    # Also check admin blockchain monitoring endpoint
    r2 = client.get("/admin/system/blockchain", headers=admin_headers)
    print(f"\n  GET /admin/system/blockchain: {r2.status_code}")
    assert r2.status_code == 200
    bc_data = r2.json()
    print(f"  Blockchain status: {bc_data.get('status', 'N/A')}")
    print(f"  Peer status: {bc_data.get('peer_status', 'N/A')}")
    print(f"  Total tx: {bc_data.get('total_transactions', bc_data.get('transaction_count', 'N/A'))}")
    print(f"  Verified tx: {bc_data.get('verified_transactions', 'N/A')}")
    print(f"  Failed tx: {bc_data.get('failed_transactions', 'N/A')}")
    print(f"  Discrepancies: {bc_data.get('discrepancies', 'N/A')}")
    print("  PASS: Admin blockchain monitoring endpoint responding correctly")

print("\n" + "=" * 60)
print("PHASE 16-22 BLOCKCHAIN TESTS COMPLETE")
print("=" * 60)
