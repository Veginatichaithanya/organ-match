import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const projectRoot = path.resolve(__dirname, "../..");
const evidenceDir = path.resolve(projectRoot, "test-results/research-evidence");

test("Capture matching research screenshot on Coordinator Matching Console", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  // 1. Login as Hospital Coordinator
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const usernameInput = page.locator("#usernameOrEmail");
  await usernameInput.waitFor({ state: "visible" });
  await page.waitForTimeout(500);
  await usernameInput.fill(process.env.PLAYWRIGHT_COORDINATOR_EMAIL || "hospital@organmatch.in");
  await page.locator("#password").fill(process.env.PLAYWRIGHT_COORDINATOR_PASSWORD || "OrganMatch2026!");
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");

  // 2. Navigate to Coordinator Matching Console
  await page.goto("/coordinator/matching");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toContainText("Compatibility Matching Console");

  // 3. Select the AVAILABLE organ ORG-K002 from the dropdown
  const selectTrigger = page.locator("button[role='combobox']");
  await selectTrigger.click();
  await page.waitForTimeout(500);

  // Click the option for ORG-K002 (or option containing AVAILABLE)
  const option = page.locator('[role="option"]:has-text("ORG-K002"), [role="option"]:has-text("AVAILABLE")').first();
  await option.click();
  await page.waitForTimeout(500);

  // 4. Check Execute Match Engine button
  const executeBtn = page.getByRole("button", { name: /Execute Match Engine/i });
  await expect(executeBtn).toBeVisible({ timeout: 15000 });
  await expect(executeBtn).toBeEnabled({ timeout: 15000 });

  // Click Execute Match Engine
  await executeBtn.click();

  // 5. Wait for matching results
  await expect(page.getByRole("heading", { name: "Best Eligible Match" })).toBeVisible({ timeout: 25000 });

  // Allow UI animation and charts to settle
  await page.waitForTimeout(2000);

  // 6. Capture research-paper screenshots
  const ssPath = path.join(evidenceDir, "organ-matching-result.png");
  const ssPathFull = path.join(evidenceDir, "organ-matching-result-full.png");

  await page.screenshot({ path: ssPath });
  await page.screenshot({ path: ssPathFull, fullPage: true });

  console.log("Captured matching screenshot to:", ssPath);
  expect(fs.existsSync(ssPath)).toBeTruthy();
});
