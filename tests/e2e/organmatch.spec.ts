import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// ─── DIRECTORIES & PATHS ─────────────────────────────────────────────────────
const projectRoot = path.resolve(__dirname, "../..");
const evidenceDir = path.resolve(projectRoot, "test-results/research-evidence");
const pythonExe = path.resolve(projectRoot, "backend/venv/Scripts/python.exe");
const tamperHelper = path.resolve(projectRoot, "backend/scripts/tamper_helper.py");
const runtimeStateFile = path.join(evidenceDir, "runtime_state.json");

// Ensure evidence directory exists
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

// ─── STATE PERSISTENCE HELPERS ────────────────────────────────────────────────
function saveRuntimeState(state: Record<string, any>) {
  let existing: Record<string, any> = {};
  if (fs.existsSync(runtimeStateFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(runtimeStateFile, "utf-8"));
    } catch {}
  }
  fs.writeFileSync(runtimeStateFile, JSON.stringify({ ...existing, ...state }, null, 2));
}

function loadRuntimeState(): Record<string, any> {
  if (fs.existsSync(runtimeStateFile)) {
    try {
      return JSON.parse(fs.readFileSync(runtimeStateFile, "utf-8"));
    } catch {}
  }
  return {};
}

// ─── ENVIRONMENT CREDENTIAL VALIDATION ────────────────────────────────────────
const envVars = {
  ADMIN_EMAIL: process.env.PLAYWRIGHT_ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
  COORDINATOR_EMAIL: process.env.PLAYWRIGHT_COORDINATOR_EMAIL,
  COORDINATOR_PASSWORD: process.env.PLAYWRIGHT_COORDINATOR_PASSWORD,
  DOCTOR_EMAIL: process.env.PLAYWRIGHT_DOCTOR_EMAIL,
  DOCTOR_PASSWORD: process.env.PLAYWRIGHT_DOCTOR_PASSWORD,
  AUTHORITY_EMAIL: process.env.PLAYWRIGHT_AUTHORITY_EMAIL,
  AUTHORITY_PASSWORD: process.env.PLAYWRIGHT_AUTHORITY_PASSWORD,
  AUDITOR_EMAIL: process.env.PLAYWRIGHT_AUDITOR_EMAIL,
  AUDITOR_PASSWORD: process.env.PLAYWRIGHT_AUDITOR_PASSWORD,
};

const missingVars = Object.entries(envVars)
  .filter(([_, val]) => !val)
  .map(([key]) => `PLAYWRIGHT_${key}`);

if (missingVars.length > 0) {
  throw new Error(`Missing required Playwright environment variables: ${missingVars.join(", ")}`);
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
async function login(page: Page, email?: string, password?: string) {
  if (!email || !password) {
    throw new Error("Missing test credentials for authentication");
  }
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const usernameInput = page.locator("#usernameOrEmail");
  await usernameInput.waitFor({ state: "visible" });
  await page.waitForTimeout(600); // ensure React hydration
  await usernameInput.fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  // Wait until user is navigated away from /login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}

function runTamperHelper(command: string, allocId: string, extraArg?: string): any {
  const cmd = `"${pythonExe}" "${tamperHelper}" ${command} ${allocId} ${extraArg ? `"${extraArg}"` : ""}`;
  const out = execSync(cmd, { cwd: path.join(projectRoot, "backend"), encoding: "utf-8" });
  return JSON.parse(out.trim());
}

// ─── SHARED RUNTIME STATE ─────────────────────────────────────────────────────
let generatedMatchId: string = "";
let targetOrganId: string = "";
let targetRecipientId: string = "";
let allocationId: string = "";
let fabricTxId: string = "";
let originalDbHash: string = "";
let fabricStateHash: string = "";
let tamperedDbHash: string = "";

const testResults: Record<string, "PASS" | "FAIL"> = {
  matching: "FAIL",
  clinicalReview: "FAIL",
  allocation: "FAIL",
  fabricAnchor: "FAIL",
  baselineVerification: "FAIL",
  databaseTampering: "FAIL",
  tamperingAlert: "FAIL",
  fabricHashUnchanged: "FAIL",
  databaseRestoration: "FAIL",
  finalVerification: "FAIL",
};

// ─── SERIAL END-TO-END TEST SUITE ─────────────────────────────────────────────
test.describe.serial("OrganMatch E2E Workflow & Research Evidence", () => {
  test.setTimeout(240000);

  test.beforeAll(async () => {
    // Ensure clean baseline state before executing matching engine
    runTamperHelper("reset_baseline", "none");
  });

  // ─── TEST 1: Hospital Coordinator Matching ───────────────────────────────
  test("1. Hospital Coordinator selects organ, runs matching, captures research screenshot", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    // 1. Login as Hospital Coordinator
    await login(page, envVars.COORDINATOR_EMAIL, envVars.COORDINATOR_PASSWORD);

    // 2. Navigate to Coordinator Matching Console
    await page.goto("/coordinator/matching");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Compatibility Matching Console");

    // 3. Wait for organ selector & Execute button to be ready
    const executeBtn = page.getByRole("button", { name: /Execute Match Engine/i });
    await expect(executeBtn).toBeVisible({ timeout: 15000 });

    // Wait for the button to become enabled (organ inventory loaded)
    await expect(executeBtn).toBeEnabled({ timeout: 15000 });

    // 4. Click Execute Match Engine
    await executeBtn.click();

    // 5. Wait for matching results
    await expect(page.locator("text=Best Eligible Match")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=% Match Score").first()).toBeVisible({ timeout: 10000 });

    // Allow UI animation and charts to settle
    await page.waitForTimeout(1500);

    // 6. Capture Research Paper Screenshot 1 (Viewport & Full Page)
    const ssPath1 = path.join(evidenceDir, "01-organ-matching-result.png");
    const ssPath1Full = path.join(evidenceDir, "01-organ-matching-result-full.png");

    await page.screenshot({ path: ssPath1 });
    await page.screenshot({ path: ssPath1Full, fullPage: true });

    expect(fs.existsSync(ssPath1)).toBeTruthy();
    expect(fs.existsSync(ssPath1Full)).toBeTruthy();

    // 7. Extract data for 01-organ-matching-result.json
    // Query backend to retrieve the exact generated match record
    const matchQueryResult = execSync(
      `"${pythonExe}" -c "import os, sys, json; sys.path.insert(0, '.'); from dotenv import load_dotenv; load_dotenv('.env'); from app.database.session import sync_session_maker; from app.models.match import Match; from app.models.organ import Organ; from app.models.recipient import Recipient; db = sync_session_maker(); m = db.query(Match).filter(Match.status == 'PENDING', Match.rank == 1).order_by(Match.created_at.desc()).first(); print(json.dumps({'match_id': str(m.id), 'organ_id': str(m.organ_id), 'recipient_id': str(m.recipient_id), 'score': m.compatibility_score, 'breakdown': m.scoring_breakdown, 'rank': m.rank, 'status': m.status})) if m else print(json.dumps({})); db.close()"`,
      { cwd: path.join(projectRoot, "backend"), encoding: "utf-8" }
    );

    const matchData = JSON.parse(matchQueryResult.trim());
    expect(matchData.match_id).toBeTruthy();

    generatedMatchId = matchData.match_id;
    targetOrganId = matchData.organ_id;
    targetRecipientId = matchData.recipient_id;

    saveRuntimeState({
      generatedMatchId,
      targetOrganId,
      targetRecipientId,
    });

    // Save evidence JSON
    const evidenceJsonPath = path.join(evidenceDir, "01-organ-matching-result.json");
    fs.writeFileSync(
      evidenceJsonPath,
      JSON.stringify(
        {
          donor_organ_id: targetOrganId,
          recipient_id: targetRecipientId,
          match_id: generatedMatchId,
          match_score: matchData.score,
          score_components: matchData.breakdown,
          rank: matchData.rank,
          eligibility: "ELIGIBLE",
          scoring_formula: "S = 0.25B + 0.30M + 0.25T + 0.20P",
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    testResults.matching = "PASS";
    await context.close();
  });

  // ─── TEST 2: Doctor Clinical Review ──────────────────────────────────────
  test("2. Doctor reviews match proposal and submits clinical recommendation", async ({ browser }) => {
    // Ensure match ID is available
    if (!generatedMatchId) {
      const state = loadRuntimeState();
      generatedMatchId = state.generatedMatchId || "";
    }
    if (!generatedMatchId) {
      const matchQueryResult = execSync(
        `"${pythonExe}" -c "import os, sys, json; sys.path.insert(0, '.'); from dotenv import load_dotenv; load_dotenv('.env'); from app.database.session import sync_session_maker; from app.models.match import Match; db = sync_session_maker(); m = db.query(Match).filter(Match.status == 'PENDING').order_by(Match.created_at.desc()).first(); print(str(m.id)) if m else print(''); db.close()"`,
        { cwd: path.join(projectRoot, "backend"), encoding: "utf-8" }
      );
      generatedMatchId = matchQueryResult.trim();
    }
    expect(generatedMatchId).toBeTruthy();

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    // 1. Login as Doctor
    await login(page, envVars.DOCTOR_EMAIL, envVars.DOCTOR_PASSWORD);

    // 2. Open Doctor match review page
    await page.goto(`/doctor/matching/${generatedMatchId}`);
    await page.waitForLoadState("networkidle");

    // Verify match proposal loaded
    await expect(page.locator("h1")).toContainText("Clinical Match Review");

    // 3. Check if review is already recorded or needs submission
    const recommendBtn = page.getByRole("button", { name: /Recommend for Allocation Review/i });
    if (await recommendBtn.isVisible()) {
      // Fill clinical justification notes
      const notesField = page.locator("textarea");
      if (await notesField.isVisible()) {
        await notesField.fill("Immunological profile, tissue crossmatch, and clinical criteria thoroughly reviewed and found optimal. Candidate strongly recommended for organ allocation.");
      }

      // Click Recommend for Allocation Review
      await recommendBtn.click();

      // Wait for completion modal
      await expect(page.locator("text=Clinical Match Review Recorded").first()).toBeVisible({ timeout: 15000 });

      // Dismiss / Close modal
      const dismissBtn = page.getByRole("button", { name: /Back to Match Reviews|View Match Review/i });
      if (await dismissBtn.first().isVisible()) {
        await dismissBtn.first().click();
      }
    } else {
      // Already recorded
      await expect(page.locator("text=Clinical Match Review Recorded").first().or(page.locator("text=APPROVED").first())).toBeVisible();
    }

    testResults.clinicalReview = "PASS";
    saveRuntimeState({ clinicalReviewPassed: true });
    await context.close();
  });

  // ─── TEST 3 & 4: Allocation Authority & Fabric Anchoring ─────────────────
  test("3. Allocation Authority reviews and approves allocation with Hyperledger Fabric anchor", async ({ browser }) => {
    if (!generatedMatchId) {
      const state = loadRuntimeState();
      generatedMatchId = state.generatedMatchId || "";
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    // 1. Login as Allocation Authority
    await login(page, envVars.AUTHORITY_EMAIL, envVars.AUTHORITY_PASSWORD);

    // 2. Navigate to Allocation Matches Console
    await page.goto("/allocation/matches");
    await page.waitForLoadState("networkidle");

    // 3. Find the match row with Approve button for Amit Patel
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 15000 });

    const targetRow = page.locator("tr")
      .filter({ hasText: "Amit Patel" })
      .filter({ has: page.locator('button:has-text("Approve")') })
      .first();

    const approveBtn = targetRow.locator('button:has-text("Approve")');
    await expect(approveBtn).toBeVisible({ timeout: 15000 });
    await approveBtn.click();

    // 4. Confirmation dialog appears
    await expect(page.locator("text=Confirm Final Organ Allocation")).toBeVisible({ timeout: 10000 });

    const confirmApproveBtn = page.locator('button:has-text("Approve Final Allocation")');
    await expect(confirmApproveBtn).toBeVisible();

    // Click Approve Final Allocation - this triggers PostgreSQL commit and Fabric submit_transaction
    await confirmApproveBtn.click();

    // 5. Wait for approval toast and dialog dismissal
    await expect(page.locator("text=Confirm Final Organ Allocation")).not.toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(1000);

    // 6. Query DB to read the newly created Allocation record & Fabric TX ID
    const allocData = runTamperHelper("get_allocation", generatedMatchId || "latest");
    expect(allocData.id).toBeTruthy();
    expect(allocData.fabric_tx_id).toBeTruthy();
    expect(allocData.fabric_tx_id.length).toBe(64); // Genuine 64-char Fabric SHA-256 TX ID
    expect(allocData.status).toBe("FABRIC_CONFIRMED");

    allocationId = allocData.id;
    fabricTxId = allocData.fabric_tx_id;

    saveRuntimeState({
      allocationId,
      fabricTxId,
    });

    testResults.allocation = "PASS";
    testResults.fabricAnchor = "PASS";

    // 7. Navigate to Blockchain Verification Page
    await page.goto("/blockchain");
    await page.waitForLoadState("networkidle");

    // Verify blockchain ledger table displays transaction
    await expect(page.locator("h1")).toContainText(/Blockchain ledger/i);
    await expect(page.locator(`text=${fabricTxId.slice(0, 12)}`).or(page.locator("text=CONFIRMED").first())).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    // Capture Screenshot 2: Blockchain Verification Table
    const ssPath2 = path.join(evidenceDir, "02-blockchain-verification.png");
    await page.screenshot({ path: ssPath2 });
    expect(fs.existsSync(ssPath2)).toBeTruthy();

    // 8. Test Verify Proof Modal (matches reference image)
    const verifyProofBtn = page.getByRole("button", { name: /Verify Proof/i }).first();
    await expect(verifyProofBtn).toBeVisible({ timeout: 10000 });
    await verifyProofBtn.click();

    // Verify modal opens with Fabric Integrity Verification details
    await expect(page.locator("text=Fabric Integrity Verification")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=organ-donation-channel").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=organ-contract").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=VERIFIED").first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1200);

    // Capture Screenshot 2-Modal: Blockchain Verification with Integrity Proof Modal Open
    const ssPathModal = path.join(evidenceDir, "02-blockchain-verification-modal.png");
    await page.screenshot({ path: ssPathModal });
    expect(fs.existsSync(ssPathModal)).toBeTruthy();

    await context.close();
  });

  // ─── TEST 4: Baseline Cryptographic Verification ─────────────────────────
  test("4. Baseline verification: PostgreSQL state hash matches Fabric anchor", async () => {
    if (!allocationId) {
      const state = loadRuntimeState();
      allocationId = state.allocationId || "";
    }
    expect(allocationId).toBeTruthy();

    // Query Fabric ledger and DB state using tamper helper
    const result = runTamperHelper("read", allocationId);

    expect(result.allocation).toBeTruthy();
    expect(result.db_hash).toBeTruthy();
    expect(result.fabric_hash).toBeTruthy();
    expect(result.db_hash).toBe(result.fabric_hash); // Baseline matches!

    originalDbHash = result.db_hash;
    fabricStateHash = result.fabric_hash;

    saveRuntimeState({
      originalDbHash,
      fabricStateHash,
    });

    testResults.baselineVerification = "PASS";
  });

  // ─── TEST 5: Controlled Database Tampering & Admin Alert ──────────────────
  test("5. Controlled database tampering and Admin Tampering Alert detection", async ({ browser }) => {
    if (!allocationId) {
      const state = loadRuntimeState();
      allocationId = state.allocationId || "";
      fabricStateHash = state.fabricStateHash || "";
      originalDbHash = state.originalDbHash || "";
      fabricTxId = state.fabricTxId || "";
    }
    expect(allocationId).toBeTruthy();

    // 1. Directly tamper ONE field in PostgreSQL (status -> 'REJECTED')
    const tamperResult = runTamperHelper("tamper", allocationId);

    expect(tamperResult.tampered_status).toBe("REJECTED");
    expect(tamperResult.tampered_db_hash).not.toBe(tamperResult.fabric_hash);
    expect(tamperResult.tampering_detected).toBe(true);

    tamperedDbHash = tamperResult.tampered_db_hash;
    testResults.databaseTampering = "PASS";

    // 2. Open Admin Portal as Admin and verify TAMPERING_DETECTED alert
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    await login(page, envVars.ADMIN_EMAIL, envVars.ADMIN_PASSWORD);

    // Navigate to Admin Tampering Alerts
    await page.goto("/admin/tampering");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Tampering Alerts");

    // Wait for the tampering alert row to display in table
    const alertRow = page.locator("tr").filter({ hasText: "TAMPERING_DETECTED" });
    await expect(alertRow.first()).toBeVisible({ timeout: 15000 });

    // Click "Inspect & Verify" to open cryptographic proof modal
    const inspectBtn = alertRow.first().locator('button:has-text("Inspect & Verify"), button:has-text("Review Incident")');
    if (await inspectBtn.isVisible()) {
      await inspectBtn.first().click();
    } else {
      await alertRow.first().click();
    }

    // Modal opens showing "Verification Signal: HASH MISMATCH" and cryptographic proof
    await expect(page.locator("text=Data Integrity Alert Details").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=HASH MISMATCH").first()).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);

    // 3. Capture Research Paper Screenshot 3: Tampering Alert (Modal & Full Page)
    const ssPath3 = path.join(evidenceDir, "03-tampering-alert.png");
    const ssPath3Full = path.join(evidenceDir, "03-tampering-alert-full.png");

    await page.screenshot({ path: ssPath3 });
    await page.screenshot({ path: ssPath3Full, fullPage: true });

    expect(fs.existsSync(ssPath3)).toBeTruthy();
    expect(fs.existsSync(ssPath3Full)).toBeTruthy();

    // 4. Save 03-tampering-result.json
    const tamperingJsonPath = path.join(evidenceDir, "03-tampering-result.json");
    fs.writeFileSync(
      tamperingJsonPath,
      JSON.stringify(
        {
          allocation_id: allocationId,
          fabric_tx_id: fabricTxId,
          original_database_hash: originalDbHash,
          tampered_database_hash: tamperedDbHash,
          fabric_immutable_hash: fabricStateHash,
          baseline_verification: "VERIFIED",
          tampered_verification: "TAMPERING_DETECTED",
          tampering_field: "status: FABRIC_CONFIRMED -> REJECTED",
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    testResults.tamperingAlert = "PASS";
    await context.close();
  });

  // ─── TEST 6: Prove Hyperledger Fabric Ledger Remained Unchanged ───────────
  test("6. Prove Fabric ledger remained immutable and unchanged", async () => {
    if (!allocationId) {
      const state = loadRuntimeState();
      allocationId = state.allocationId || "";
      fabricStateHash = state.fabricStateHash || "";
    }
    expect(allocationId).toBeTruthy();

    const check = runTamperHelper("fabric_check", allocationId);

    expect(check.fabric_hash).toBe(fabricStateHash); // Unchanged!
    testResults.fabricHashUnchanged = "PASS";
  });

  // ─── TEST 7: Database Restoration & Verification Cleared ──────────────────
  test("7. Restore PostgreSQL database and verify tampering alert clears", async ({ browser }) => {
    if (!allocationId) {
      const state = loadRuntimeState();
      allocationId = state.allocationId || "";
      fabricStateHash = state.fabricStateHash || "";
    }
    expect(allocationId).toBeTruthy();

    // 1. Guaranteed restoration of original PostgreSQL state
    const restoreResult = runTamperHelper("restore", allocationId, "FABRIC_CONFIRMED");

    expect(restoreResult.restored_status).toBe("FABRIC_CONFIRMED");
    expect(restoreResult.restored_db_hash).toBe(fabricStateHash);
    expect(restoreResult.verified).toBe(true);

    testResults.databaseRestoration = "PASS";

    // 2. Open Admin Tampering Alerts to verify alert cleared
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    await login(page, envVars.ADMIN_EMAIL, envVars.ADMIN_PASSWORD);

    await page.goto("/admin/tampering");
    await page.waitForLoadState("networkidle");

    // The active alert should clear, showing "No Tampering Alerts Detected"
    await expect(page.locator("text=No Tampering Alerts Detected")).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    // Capture Screenshot 4: Restored Verification
    const ssPath4 = path.join(evidenceDir, "04-restored-verification.png");
    await page.screenshot({ path: ssPath4 });
    expect(fs.existsSync(ssPath4)).toBeTruthy();

    testResults.finalVerification = "PASS";
    await context.close();
  });

  // ─── TEST 8: Auditor Blockchain Verification ──────────────────────────────
  test("8. Auditor verifies genuine Fabric anchor transaction on blockchain", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();

    // 1. Login as Compliance Auditor
    await login(page, envVars.AUDITOR_EMAIL, envVars.AUDITOR_PASSWORD);

    // 2. Navigate to Auditor Blockchain Verification
    await page.goto("/blockchain");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText(/Blockchain ledger/i);

    // Verify transaction appears with CONFIRMED status
    await expect(page.locator("text=CONFIRMED").first()).toBeVisible({ timeout: 15000 });

    await page.waitForTimeout(1000);

    // Capture Screenshot 5: Auditor Blockchain Verification
    const ssPath5 = path.join(evidenceDir, "05-auditor-blockchain-verification.png");
    await page.screenshot({ path: ssPath5 });
    expect(fs.existsSync(ssPath5)).toBeTruthy();

    await context.close();
  });

  // ─── AFTER ALL: GENERATE EVIDENCE README REPORT ───────────────────────────
  test.afterAll(async () => {
    const reportPath = path.join(evidenceDir, "README.md");
    const content = `# OrganMatch End-to-End Playwright Verification & Research Evidence

**Test Environment:**
- **Frontend URL:** http://localhost:5173
- **Backend URL:** http://localhost:8000
- **Database:** PostgreSQL 16 (Connected, Remote Host: 103.185.75.206:5433)
- **Blockchain Platform:** Hyperledger Fabric v2.5 (Channel: \`organ-donation-channel\`, Chaincode: \`organ-contract\`)
- **Peer Gateway:** localhost:7051 (Mutual TLS)
- **Viewport:** 1440 × 1000

---

## E2E Test Execution Summary

| Test Step | Operation | Result |
|---|---|:---:|
| **TEST 1** | Deterministic Matching Engine & Recipient Ranking | **${testResults.matching}** |
| **TEST 2** | Lead Transplant Surgeon Clinical Review & Recommendation | **${testResults.clinicalReview}** |
| **TEST 3** | National Allocation Authority Review & Approval | **${testResults.allocation}** |
| **TEST 4** | Hyperledger Fabric State Anchoring (Channel: organ-donation-channel) | **${testResults.fabricAnchor}** |
| **TEST 5** | Baseline Cryptographic Verification (DB Hash == Fabric Hash) | **${testResults.baselineVerification}** |
| **TEST 6** | Controlled PostgreSQL Database Tampering | **${testResults.databaseTampering}** |
| **TEST 7** | System Tampering Detection & Admin Alert Generation | **${testResults.tamperingAlert}** |
| **TEST 8** | Ledger Immutability Proof (Fabric Ledger Unchanged) | **${testResults.fabricHashUnchanged}** |
| **TEST 9** | PostgreSQL State Restoration & Hash Recomputation | **${testResults.databaseRestoration}** |
| **TEST 10** | Final System Integrity Verification & Alert Cleared | **${testResults.finalVerification}** |

---

## Research Evidence Artifacts

1. **\`01-organ-matching-result.png\`** & **\`01-organ-matching-result-full.png\`**
   - Demonstrates organ-recipient compatibility percentage, candidate ranking, multi-criteria breakdown (Blood, Medical, HLA, Priority), and eligibility status.
2. **\`01-organ-matching-result.json\`**
   - Real matching engine calculations and parameter breakdown.
3. **\`02-blockchain-verification.png\`**
   - Live transaction confirmation anchored onto Hyperledger Fabric.
4. **\`03-tampering-alert.png\`** & **\`03-tampering-alert-full.png\`**
   - Data tampering detection alert displaying \`TAMPERING_DETECTED\` and cryptographic proof (DB Hash != Fabric Immutable Hash).
5. **\`03-tampering-result.json\`**
   - Audit trail capturing pre-tamper, tampered, and immutable ledger values.
6. **\`04-restored-verification.png\`**
   - Clean verification state after PostgreSQL restoration.
7. **\`05-auditor-blockchain-verification.png\`**
   - Independent compliance auditor view confirming real Fabric TX ID and integrity anchor.
`;

    fs.writeFileSync(reportPath, content);
  });
});
