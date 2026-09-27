import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// ─── DIRECTORIES & PATHS ─────────────────────────────────────────────────────
const projectRoot = path.resolve(__dirname, "../..");
const evidenceDir = path.resolve(projectRoot, "test-results/research-evidence");
const pythonExe = path.resolve(projectRoot, "backend/venv/Scripts/python.exe");
const tamperHelper = path.resolve(projectRoot, "backend/scripts/tamper_helper.py");

if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// ─── CREDENTIALS FROM ENVIRONMENT ────────────────────────────────────────────
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("Missing required PLAYWRIGHT_ADMIN_EMAIL or PLAYWRIGHT_ADMIN_PASSWORD in environment.");
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function runTamper(command: string, allocId: string, extraArg?: string): any {
  const cmd = `"${pythonExe}" "${tamperHelper}" ${command} ${allocId} ${extraArg ? `"${extraArg}"` : ""}`;
  const out = execSync(cmd, { cwd: path.join(projectRoot, "backend"), encoding: "utf-8" });
  return JSON.parse(out.trim());
}

async function loginAsAdmin(page: Page) {
  await page.setViewportSize({ width: 1560, height: 1000 });
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const usernameInput = page.locator("#usernameOrEmail");
  await usernameInput.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await usernameInput.fill(ADMIN_EMAIL!);
  await page.locator("#password").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

// ─── TEST SUITE ──────────────────────────────────────────────────────────────
test.describe.serial("OrganMatch Real End-to-End Tampering Detection Test", () => {
  let allocationId: string = "";
  let fabricTxId: string = "";
  let originalDbHash: string = "";
  let immutableFabricHash: string = "";
  let tamperedDbHash: string = "";
  let originalStatus: string = "FABRIC_CONFIRMED";

  const checklist: Record<string, "PASS" | "FAIL"> = {
    Environment: "FAIL",
    PostgreSQL: "FAIL",
    HyperledgerFabric: "FAIL",
    RealFabricAnchor: "FAIL",
    BaselineVerification: "FAIL",
    DatabaseTampering: "FAIL",
    HashMismatch: "FAIL",
    TAMPERING_DETECTED: "FAIL",
    AdminAlert: "FAIL",
    AlertDetails: "FAIL",
    FabricHashUnchanged: "FAIL",
    DatabaseRestoration: "FAIL",
    FinalVERIFIED: "FAIL",
  };

  test("1. Verify Environment & Identify Real Fabric Anchored Allocation", async ({ request }) => {
    // A. Backend API Reachable
    const beRes = await request.get("http://localhost:8000/api/system/health").catch(() => null);
    expect(beRes, "Backend at http://localhost:8000 must be online").toBeTruthy();
    checklist.Environment = "PASS";

    // B. Identify Real Anchored Allocation from PostgreSQL
    const allocData = runTamper("get_allocation", "latest");
    expect(allocData.id, "Valid allocation ID must exist in PostgreSQL").toBeTruthy();
    expect(allocData.fabric_tx_id, "Allocation must have a Fabric TX ID").toBeTruthy();

    allocationId = allocData.id;
    fabricTxId = allocData.fabric_tx_id;
    originalStatus = allocData.status || "FABRIC_CONFIRMED";

    checklist.PostgreSQL = "PASS";

    // C. Important Fabric Validation (Strict Failure Conditions)
    // 1. Must NOT start with 'fab_tx_' or locally generated fake prefix
    expect(fabricTxId.startsWith("fab_tx_"), "TX ID must not start with fab_tx_").toBe(false);
    expect(fabricTxId.length, "Fabric TX ID must be genuine 64-char hex SHA256").toBe(64);

    // 2. Query real Fabric ledger asset via GetAsset
    const readBaseline = runTamper("read", allocationId);
    expect(readBaseline.fabric_asset, "Fabric asset must be retrieved from ledger").toBeTruthy();
    expect(readBaseline.fabric_asset.record_id).toBe(allocationId);
    expect(readBaseline.fabric_hash, "Immutable Fabric state hash must exist").toBeTruthy();

    immutableFabricHash = readBaseline.fabric_hash;
    originalDbHash = readBaseline.db_hash;

    // 3. Baseline Verification: DATABASE HASH == FABRIC HASH
    expect(originalDbHash).toBe(immutableFabricHash);
    expect(readBaseline.hashes_match).toBe(true);

    checklist.HyperledgerFabric = "PASS";
    checklist.RealFabricAnchor = "PASS";
    checklist.BaselineVerification = "PASS";

    console.log("================ BASELINE VERIFIED ================");
    console.log(`Allocation ID:         ${allocationId}`);
    console.log(`Fabric TX ID:          ${fabricTxId}`);
    console.log(`Original DB Hash:      ${originalDbHash}`);
    console.log(`Immutable Fabric Hash: ${immutableFabricHash}`);
    console.log("===================================================");
  });

  test("2. Admin Baseline Screenshot (No active alerts before tampering)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/tampering");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Tampering Alerts");
    await page.waitForTimeout(800);

    // Capture Screenshot 1: Baseline Verified
    const ss1 = path.join(evidenceDir, "01-baseline-verified.png");
    await page.screenshot({ path: ss1 });
    expect(fs.existsSync(ss1)).toBe(true);
  });

  test("3. Controlled DB Tampering, Hash Mismatch & Backend Tampering Detection", async ({ page, request }) => {
    if (!allocationId) {
      const allocData = runTamper("get_allocation", "latest");
      allocationId = allocData.id;
      fabricTxId = allocData.fabric_tx_id;
      originalStatus = allocData.status || "FABRIC_CONFIRMED";
      const baseline = runTamper("read", allocationId);
      originalDbHash = baseline.db_hash;
      immutableFabricHash = baseline.fabric_hash;
    }
    expect(allocationId).toBeTruthy();

    try {
      // 1. Directly modify ONE protected PostgreSQL field
      const tamperRes = runTamper("tamper", allocationId);
      expect(tamperRes.tampered_status).toBe("REJECTED");
      tamperedDbHash = tamperRes.tampered_db_hash;
      checklist.DatabaseTampering = "PASS";

      // 2. Recompute Hash: CURRENT DATABASE HASH != IMMUTABLE FABRIC HASH
      expect(tamperedDbHash).not.toBe(immutableFabricHash);
      expect(tamperRes.tampering_detected).toBe(true);
      checklist.HashMismatch = "PASS";

      // 3. Query Fabric again to prove ledger was NOT modified
      const fabricCheck = runTamper("fabric_check", allocationId);
      expect(fabricCheck.fabric_hash).toBe(immutableFabricHash);
      checklist.FabricHashUnchanged = "PASS";

      // 4. Open Admin Portal -> Tampering Alerts
      await loginAsAdmin(page);
      await page.goto("/admin/tampering");
      await page.waitForLoadState("networkidle");

      // Verify row appears with TAMPERING_DETECTED and HASH MISMATCH
      const alertRow = page.locator("tr").filter({ hasText: "TAMPERING_DETECTED" });
      await expect(alertRow.first()).toBeVisible({ timeout: 15000 });
      await expect(alertRow.first()).toContainText("HASH MISMATCH");
      checklist.AdminAlert = "PASS";

      // Capture Screenshot 2: Tampering Alert Row
      const ss2 = path.join(evidenceDir, "02-tampering-alert.png");
      await page.screenshot({ path: ss2 });
      expect(fs.existsSync(ss2)).toBe(true);

      // 5. Click "Inspect & Verify" to open the updated alert modal
      await alertRow.first().locator('button:has-text("Inspect & Verify")').click();

      // 6. Verify modal contents match reference UI specifications
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await expect(modal.locator("text=Data Integrity Alert Details")).toBeVisible();
      await expect(modal.locator("text=TAMPERING DETECTED")).toBeVisible();
      await expect(modal.locator("text=HASH MISMATCH")).toBeVisible();
      await expect(modal.locator("text=The current database state hash does not match the immutable Hyperledger Fabric ledger hash.")).toBeVisible();

      // Verify Cryptographic Proof section displays real values
      await expect(modal.locator("text=CRYPTOGRAPHIC PROOF VERIFICATION")).toBeVisible();
      await expect(modal.locator(`text=${allocationId}`).first()).toBeVisible();

      // Verify Red Database State Hash vs Green Immutable Fabric Hash
      await expect(modal.locator(`text=${tamperedDbHash}`).first()).toBeVisible();
      await expect(modal.locator(`text=${immutableFabricHash}`).first()).toBeVisible();
      await expect(modal.locator(`text=${fabricTxId}`).first()).toBeVisible();

      checklist.TAMPERING_DETECTED = "PASS";
      checklist.AlertDetails = "PASS";

      await page.waitForTimeout(1000);

      // 7. Capture REQUIRED Research Paper Screenshots
      const ss3 = path.join(evidenceDir, "03-tampering-alert-details.png");
      const ss3Alt = path.join(evidenceDir, "tampering-alert.png");
      const ss3Full = path.join(evidenceDir, "tampering-alert-full.png");

      await page.screenshot({ path: ss3 });
      await page.screenshot({ path: ss3Alt });
      await page.screenshot({ path: ss3Full, fullPage: true });

      expect(fs.existsSync(ss3)).toBe(true);
      expect(fs.existsSync(ss3Alt)).toBe(true);

      // 8. Test "Verify Again" button calls real backend verification and keeps TAMPERING_DETECTED
      const verifyAgainBtn = modal.locator('button:has-text("Verify Again")');
      await verifyAgainBtn.click();
      await page.waitForTimeout(1500);

      // Result must remain TAMPERING DETECTED because DB is still tampered
      await expect(modal.locator("text=TAMPERING DETECTED")).toBeVisible();
      await expect(modal.locator("text=HASH MISMATCH")).toBeVisible();

      // 9. Save test evidence JSON
      const evidenceJsonPath = path.join(evidenceDir, "tampering-evidence.json");
      fs.writeFileSync(
        evidenceJsonPath,
        JSON.stringify(
          {
            allocation_id: allocationId,
            fabric_tx_id: fabricTxId,
            original_database_hash: originalDbHash,
            tampered_database_hash: tamperedDbHash,
            immutable_fabric_hash: immutableFabricHash,
            baseline_status: originalStatus,
            tampered_status: "REJECTED",
            fabric_hash_unchanged: true,
            detection_status: "TAMPERING_DETECTED",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
      expect(fs.existsSync(evidenceJsonPath)).toBe(true);

    } finally {
      // 10. GUARANTEED RESTORATION OF ORIGINAL POSTGRESQL STATE
      const restoreRes = runTamper("restore", allocationId, originalStatus);
      expect(restoreRes.restored_status).toBe(originalStatus);
      expect(restoreRes.restored_db_hash).toBe(immutableFabricHash);
      expect(restoreRes.verified).toBe(true);
      checklist.DatabaseRestoration = "PASS";
    }
  });

  test("4. Verify Database Restoration in Admin UI", async ({ page }) => {
    if (!allocationId) {
      const allocData = runTamper("get_allocation", "latest");
      allocationId = allocData.id;
      const baseline = runTamper("read", allocationId);
      immutableFabricHash = baseline.fabric_hash;
    }
    // Re-verify that Fabric ledger hash still matches the restored DB state
    const readRestored = runTamper("read", allocationId);
    expect(readRestored.db_hash).toBe(immutableFabricHash);
    expect(readRestored.hashes_match).toBe(true);
    checklist.FinalVERIFIED = "PASS";

    // Open Admin Tampering Alerts page and confirm alert is cleared
    await loginAsAdmin(page);
    await page.goto("/admin/tampering");
    await page.waitForLoadState("networkidle");

    // The active mismatch alert should now be cleared
    await expect(page.locator("text=No Tampering Alerts Detected")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);

    // Capture Screenshot 4: Restored Verified
    const ss4 = path.join(evidenceDir, "04-restored-verified.png");
    await page.screenshot({ path: ss4 });
    expect(fs.existsSync(ss4)).toBe(true);

    // Print summary report
    console.log("\n==================================================");
    console.log("       PLAYWRIGHT TAMPERING TEST SUMMARY          ");
    console.log("==================================================");
    for (const [item, status] of Object.entries(checklist)) {
      console.log(`${item.padEnd(26)}: ${status}`);
    }
    console.log("==================================================");

    // Final assertion that every single criterion passed
    for (const [item, status] of Object.entries(checklist)) {
      expect(status, `${item} must pass`).toBe("PASS");
    }
  });
});
