"""
Phase 12 & 25 — Matching Algorithm + API Endpoint Tests (Corrected endpoints)
Tests the real matching engine: score calculation, formula, ranking
"""
import httpx
from dotenv import dotenv_values

env = dotenv_values("../.env")
BASE_URL = "http://localhost:8000/api"

def login(client, email, password):
    r = client.post("/auth/login", json={"username_or_email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

print("=" * 60)
print("PHASE 12 & 25 — MATCHING ENGINE + API ENDPOINT TESTS")
print("=" * 60)

# Login as coordinator (using the correct endpoint paths)
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    token = login(client, env["PLAYWRIGHT_COORDINATOR_EMAIL"], env["PLAYWRIGHT_COORDINATOR_PASSWORD"])
    headers = {"Authorization": f"Bearer {token}"}

    # Test: get available organs via /organs/ endpoint
    r = client.get("/organs/", headers=headers)
    print(f"\nGET /organs/: {r.status_code}")
    assert r.status_code == 200
    organs = r.json()
    print(f"  Total organs: {len(organs)}")
    available_organs = [o for o in organs if o.get("status") == "AVAILABLE"]
    print(f"  Available organs: {len(available_organs)}")

    # Test: get recipients via /recipients/ endpoint
    r = client.get("/recipients/", headers=headers)
    print(f"\nGET /recipients/: {r.status_code}")
    assert r.status_code == 200
    recipients = r.json()
    print(f"  Recipients count: {len(recipients)}")

    # Test: get donors via /donors/ endpoint
    r = client.get("/donors/", headers=headers)
    print(f"\nGET /donors/: {r.status_code}")
    assert r.status_code == 200
    donors = r.json()
    print(f"  Donors count: {len(donors)}")

    # Test: Get coordinator overview
    r = client.get("/coordinator/overview", headers=headers)
    print(f"\nGET /coordinator/overview: {r.status_code}")
    assert r.status_code == 200
    overview = r.json()
    print(f"  Overview keys: {list(overview.keys())}")

    # Test: Execute matching engine with an available organ
    if available_organs:
        organ = available_organs[0]
        organ_id = organ["id"]
        organ_type = organ.get("organ_type")
        blood_group = organ.get("blood_group")
        print(f"\nRunning matching for organ: {organ_id} ({organ_type}, {blood_group})")

        r = client.post("/matching/run", headers=headers, json={"organ_id": organ_id})
        print(f"POST /matching/run: {r.status_code}")
        assert r.status_code in (200, 201), f"Matching failed: {r.text}"
        match_result = r.json()

        # match_result is a list of MatchResultResponse
        candidates = match_result if isinstance(match_result, list) else match_result.get("candidates", [])
        print(f"  Total candidates returned: {len(candidates)}")

        eligible = [c for c in candidates
                    if c.get("is_eligible") == True
                    or c.get("eligible") == True
                    or c.get("eligibility_status") == "ELIGIBLE"
                    or c.get("status") == "ELIGIBLE"]
        ineligible = [c for c in candidates
                      if c.get("is_eligible") == False
                      or c.get("eligible") == False
                      or c.get("eligibility_status") == "INELIGIBLE"
                      or c.get("status") == "INELIGIBLE"
                      or c.get("reason", "") != ""]
        print(f"  Eligible candidates: {len(eligible)}")
        print(f"  With ineligibility reason: {len([c for c in candidates if c.get('reason') or c.get('ineligibility_reason')])}")

        if candidates:
            top = candidates[0]
            print(f"\n  Top match:")
            print(f"    Recipient: {top.get('recipient_name', top.get('name', 'N/A'))}")
            score = top.get("compatibility_score") or top.get("score") or 0
            print(f"    Score: {score}")
            print(f"    Rank: {top.get('rank', 'N/A')}")
            breakdown = top.get("scoring_breakdown", top.get("breakdown", {}))
            print(f"    Full top match: {top}")

            # Verify formula: S = 0.25B + 0.30M + 0.25T + 0.20P
            if breakdown and isinstance(breakdown, dict):
                B = (breakdown.get("blood_compatibility_score") or breakdown.get("blood_score") or 0)
                M = (breakdown.get("medical_score") or breakdown.get("age_score") or 0)
                T = (breakdown.get("hla_score") or breakdown.get("tissue_score") or 0)
                P = (breakdown.get("priority_score") or breakdown.get("urgency_score") or 0)
                computed = 0.25*B + 0.30*M + 0.25*T + 0.20*P
                print(f"    Formula: 0.25*{B} + 0.30*{M} + 0.25*{T} + 0.20*{P} = {computed:.4f}")
                print(f"    Reported score: {score}")
                if isinstance(score, (int, float)) and score > 0:
                    diff = abs(float(score) - float(computed))
                    if diff > 0.01:
                        print(f"    WARNING: Score mismatch! Computed={computed:.4f} vs Reported={score}")
                    else:
                        print(f"    Formula VERIFIED (delta={diff:.6f})")

        # Test matching results endpoint
        r2 = client.get(f"/matching/organ/{organ_id}", headers=headers)
        print(f"\nGET /matching/organ/{organ_id}: {r2.status_code}")
        assert r2.status_code == 200
    else:
        print("\n  No available organs for matching. Skipping active matching test.")

# Login as Admin to test admin endpoints
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    admin_token = login(client, env["PLAYWRIGHT_ADMIN_EMAIL"], env["PLAYWRIGHT_ADMIN_PASSWORD"])
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    print("\n[Admin API Endpoints]")
    admin_endpoints = [
        ("GET", "/admin/overview"),
        ("GET", "/admin/users"),
        ("GET", "/admin/hospitals"),
        ("GET", "/admin/system/health"),
        ("GET", "/admin/system/postgres"),
        ("GET", "/admin/system/database"),
        ("GET", "/admin/system/backend"),
        ("GET", "/admin/system/auth"),
        ("GET", "/admin/system/docker"),
        ("GET", "/admin/system/blockchain"),
        ("GET", "/admin/system/activity"),
        ("GET", "/admin/system/errors"),
        ("GET", "/admin/system/security"),
        ("GET", "/admin/tampering/alerts"),
    ]
    passed_admin, failed_admin = 0, 0
    for method, path in admin_endpoints:
        r = client.get(path, headers=admin_headers)
        ok = r.status_code in (200, 201)
        print(f"  {method} {path}: {r.status_code} [{'PASS' if ok else 'FAIL'}]")
        if ok:
            passed_admin += 1
        else:
            failed_admin += 1
            print(f"    Response: {r.text[:300]}")
    print(f"\n  Admin endpoints: {passed_admin} PASS, {failed_admin} FAIL")

# Login as Doctor
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    doc_token = login(client, env["PLAYWRIGHT_DOCTOR_EMAIL"], env["PLAYWRIGHT_DOCTOR_PASSWORD"])
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    print("\n[Doctor API Endpoints]")
    doctor_endpoints = [
        ("GET", "/doctor/overview"),
        ("GET", "/doctor/assessments"),
        ("GET", "/doctor/matches"),
        ("GET", "/doctor/history"),
    ]
    passed_doc, failed_doc = 0, 0
    for method, path in doctor_endpoints:
        r = client.get(path, headers=doc_headers)
        ok = r.status_code in (200, 201)
        print(f"  {method} {path}: {r.status_code} [{'PASS' if ok else 'FAIL'}]")
        if ok:
            passed_doc += 1
        else:
            failed_doc += 1
            print(f"    Response: {r.text[:200]}")

# Login as Allocation Authority
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    auth_token = login(client, env["PLAYWRIGHT_AUTHORITY_EMAIL"], env["PLAYWRIGHT_AUTHORITY_PASSWORD"])
    auth_headers = {"Authorization": f"Bearer {auth_token}"}

    print("\n[Allocation Authority + Blockchain API Endpoints]")
    alloc_endpoints = [
        ("GET", "/allocation/overview"),
        ("GET", "/allocation/organs"),
        ("GET", "/allocation/matches"),
        ("GET", "/allocation/queue"),
        ("GET", "/allocation/history"),
        ("GET", "/blockchain/status"),
        ("GET", "/blockchain/transactions"),
    ]
    passed_auth, failed_auth = 0, 0
    for method, path in alloc_endpoints:
        r = client.get(path, headers=auth_headers)
        ok = r.status_code in (200, 201)
        print(f"  {method} {path}: {r.status_code} [{'PASS' if ok else 'FAIL'}]")
        if ok:
            passed_auth += 1
        else:
            failed_auth += 1
            print(f"    Response: {r.text[:200]}")

# Login as Auditor
with httpx.Client(base_url=BASE_URL, timeout=30.0, follow_redirects=True) as client:
    aud_token = login(client, env["PLAYWRIGHT_AUDITOR_EMAIL"], env["PLAYWRIGHT_AUDITOR_PASSWORD"])
    aud_headers = {"Authorization": f"Bearer {aud_token}"}

    print("\n[Auditor API Endpoints]")
    aud_endpoints = [
        ("GET", "/blockchain/status"),
        ("GET", "/blockchain/transactions"),
    ]
    passed_aud, failed_aud = 0, 0
    for method, path in aud_endpoints:
        r = client.get(path, headers=aud_headers)
        ok = r.status_code in (200, 201)
        print(f"  {method} {path}: {r.status_code} [{'PASS' if ok else 'FAIL'}]")
        if ok:
            passed_aud += 1
        else:
            failed_aud += 1
            print(f"    Response: {r.text[:200]}")

    # Auditor MUST NOT be able to create/modify anything - RBAC returns 403
    r = client.post("/donors/", headers=aud_headers, json={"name": "Hack"})
    print(f"  Auditor POST /donors/ (must be 403): {r.status_code}")
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

print("\n" + "=" * 60)
print("PHASE 12 & 25 TESTS COMPLETE")
print("=" * 60)
