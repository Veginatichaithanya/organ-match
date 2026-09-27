import httpx, json
from dotenv import dotenv_values
env = dotenv_values("../.env")
with httpx.Client(base_url="http://localhost:8000/api", timeout=30, follow_redirects=True) as c:
    token = c.post("/auth/login", json={"username_or_email": env["PLAYWRIGHT_ADMIN_EMAIL"], "password": env["PLAYWRIGHT_ADMIN_PASSWORD"]}).json()["access_token"]
    hdr = {"Authorization": "Bearer " + token}
    txns = c.get("/blockchain/transactions", headers=hdr).json()
    items = txns.get("items", [])
    print("total:", txns.get("total"))
    print("items count:", len(items))
    if items:
        print("first item:", json.dumps(items[0], indent=2))
    
    allocs = c.get("/allocations/", headers=hdr).json()
    print("\nallocs count:", len(allocs))
    if allocs:
        print("first alloc keys:", list(allocs[0].keys()))
    fabric_alloc = [a for a in allocs if a.get("fabric_tx_id")]
    print("allocs with fabric_tx_id:", len(fabric_alloc))
    if fabric_alloc:
        a = fabric_alloc[0]
        aid = a["id"]
        print("fabric_tx_id:", a.get("fabric_tx_id"))
        print("status:", a.get("status"))
        print("id:", aid)
        r = c.get("/blockchain/verify/" + aid, headers=hdr)
        print("verify status:", r.status_code)
        print("verify data:", json.dumps(r.json(), indent=2)[:1000])
    else:
        # Try first allocation regardless
        if allocs:
            aid = allocs[0]["id"]
            r = c.get("/blockchain/verify/" + aid, headers=hdr)
            print("verify non-fabric alloc:", r.status_code)
            print("verify data:", json.dumps(r.json(), indent=2)[:600])
