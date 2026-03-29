/**
 * TesseractTwist — Mobile E2E tests
 *
 * Runs against the Docker-served app using Pixel 5 device emulation
 */

import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

/* ───────────────────── helpers ────────────────────── */

async function startGame(page, n = 2) {
    await page.goto("/");
    const input = page.locator("#grid-size");
    await input.fill(String(n));
    await page.click("#init-btn");
    await expect(page.locator("#hud")).toHaveClass(/visible/, { timeout: 15000 });
}

/* ═════════════════════════════════════════════════════
   Mobile Layout
   ═════════════════════════════════════════════════════ */

test.describe("Mobile Layout", () => {
    test("mobile controls toolbar is visible after init", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("#mobile-controls")).toHaveClass(/visible/);
    });

    test("desktop-only panels are hidden on mobile", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("#slice-panel")).not.toBeVisible();
        await expect(page.locator("#legend-toggle")).not.toBeVisible();
        await expect(page.locator("#hint-btn")).not.toBeVisible();
    });

    test("has 4 axis buttons, 6 plane buttons, and N slice buttons", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("[data-maxis]")).toHaveCount(4);
        await expect(page.locator("[data-mplane]")).toHaveCount(6);
        await expect(page.locator("[data-mslice]")).toHaveCount(2); // N=2
    });

    test("N=3 has 3 slice buttons", async ({ page }) => {
        await startGame(page, 3);
        await expect(page.locator("[data-mslice]")).toHaveCount(3);
    });
});

/* ═════════════════════════════════════════════════════
   Mobile Rotation
   ═════════════════════════════════════════════════════ */

test.describe("Mobile Rotation", () => {
    test("tapping a valid plane button performs a rotation", async ({ page }) => {
        await startGame(page);
        // X-axis default, YZ(2) is valid
        await page.locator('button[data-mplane="2"]').click();
        await page.waitForTimeout(500);
        await expect(page.locator("#hud-moves")).toHaveText("1");
    });

    test("invalid plane buttons are disabled", async ({ page }) => {
        await startGame(page);
        // X-axis: XY(0) is invalid
        const xyBtn = page.locator('button[data-mplane="0"]');
        await expect(xyBtn).toHaveClass(/disabled/);
    });

    test("switching axis updates which planes are disabled", async ({ page }) => {
        await startGame(page);
        // Switch to Y-axis
        await page.locator('button[data-maxis="1"]').click();
        // On Y-axis: XY(0) is invalid, XZ(1) is valid
        const xyBtn = page.locator('button[data-mplane="0"]');
        const xzBtn = page.locator('button[data-mplane="1"]');
        await expect(xyBtn).toHaveClass(/disabled/);
        await expect(xzBtn).not.toHaveClass(/disabled/);
    });
});

/* ═════════════════════════════════════════════════════
   Mobile Axis & Slice Selection
   ═════════════════════════════════════════════════════ */

test.describe("Mobile Axis & Slice", () => {
    test("tapping axis button changes active axis", async ({ page }) => {
        await startGame(page);
        await page.locator('button[data-maxis="2"]').click();
        await expect(page.locator("#slice-axis")).toHaveText("Z");
        // Verify highlight
        await expect(page.locator('button[data-maxis="2"]')).toHaveClass(/active/);
        await expect(page.locator('button[data-maxis="0"]')).not.toHaveClass(/active/);
    });

    test("tapping slice button changes active slice", async ({ page }) => {
        await startGame(page);
        await page.locator('button[data-mslice="1"]').click();
        await expect(page.locator("#slice-idx")).toHaveText("1");
        await expect(page.locator('button[data-mslice="1"]')).toHaveClass(/active/);
        await expect(page.locator('button[data-mslice="0"]')).not.toHaveClass(/active/);
    });
});

/* ═════════════════════════════════════════════════════
   Mobile Direction Toggle
   ═════════════════════════════════════════════════════ */

test.describe("Mobile Direction", () => {
    test("direction toggle switches between CW and CCW", async ({ page }) => {
        await startGame(page);
        const dirBtn = page.locator("#m-dir-btn");
        await expect(dirBtn).toContainText("CW");
        await dirBtn.click();
        await expect(dirBtn).toContainText("CCW");
        await dirBtn.click();
        await expect(dirBtn).toContainText("CW");
    });
});

/* ═════════════════════════════════════════════════════
   Mobile Actions
   ═════════════════════════════════════════════════════ */

test.describe("Mobile Actions", () => {
    test("scramble button works", async ({ page }) => {
        await startGame(page);
        await page.click("#m-scramble");
        await page.waitForTimeout(200);
        // Still has 0 user moves (scramble is not a user move)
        await expect(page.locator("#hud-moves")).toHaveText("0");
    });

    test("hint button opens hint modal", async ({ page }) => {
        await startGame(page);
        await page.click("#m-hint");
        await expect(page.locator("#hint-modal")).toHaveClass(/visible/);
    });

    test("help button toggles controls legend", async ({ page }) => {
        await startGame(page);
        // Legend starts visible on init, but is hidden by mobile CSS
        // The help button should toggle the visible class
        await page.click("#m-legend");
        // On mobile the CSS hides it via media query, but class is toggled
        const panelClass = await page.locator("#controls-panel").getAttribute("class");
        // After toggle, the visible class should be removed (was added on init)
        expect(panelClass).not.toMatch(/visible/);
    });
});
