/**
 * TesseractTwist — End-to-end Playwright tests
 *
 * Runs against the Docker-served app at http://127.0.0.1:9090
 */

import { test, expect } from "@playwright/test";

/* ───────────────────── helpers ────────────────────── */

async function startGame(page, n = 2) {
    await page.goto("/");

    // Capture any page errors (e.g. WebGL failures)
    const pageErrors = [];
    page.on("pageerror", err => pageErrors.push(err.message));

    const input = page.locator("#grid-size");
    await input.fill(String(n));
    await page.click("#init-btn");
    // Wait for HUD to appear — means the game booted successfully
    await expect(page.locator("#hud")).toHaveClass(/visible/, { timeout: 15000 });
}

/* ═════════════════════════════════════════════════════
   Page Load & Start Modal
   ═════════════════════════════════════════════════════ */

test.describe("Page Load", () => {
    test("index page loads with correct title", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/TesseractTwist/);
    });

    test("start modal is visible on load", async ({ page }) => {
        await page.goto("/");
        const modal = page.locator("#start-modal");
        await expect(modal).toBeVisible();
    });

    test("canvas element exists", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#render-canvas")).toBeAttached();
    });

    test("grid-size input defaults to 2", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("#grid-size")).toHaveValue("2");
    });
});

/* ═════════════════════════════════════════════════════
   Game Initialization
   ═════════════════════════════════════════════════════ */

test.describe("Game Init", () => {
    test("clicking init hides start modal and shows HUD", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("#start-modal")).toHaveClass(/hidden/);
        await expect(page.locator("#hud")).toHaveClass(/visible/);
    });

    test("HUD shows solved percentage after init", async ({ page }) => {
        await startGame(page);
        // Game scrambles on init, so pct should be a number followed by %
        await expect(page.locator("#hud-pct")).toHaveText(/%$/);
    });

    test("slice panel appears with default axis X and index 0", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("#slice-panel")).toHaveClass(/visible/);
        await expect(page.locator("#slice-axis")).toHaveText("X");
        await expect(page.locator("#slice-idx")).toHaveText("0");
    });

    test("legend and hint buttons become visible", async ({ page }) => {
        await startGame(page);
        await expect(page.locator("#legend-toggle")).toHaveClass(/visible/);
        await expect(page.locator("#hint-btn")).toHaveClass(/visible/);
    });

    test("no console errors during init", async ({ page }) => {
        const errors = [];
        page.on("console", msg => {
            if (msg.type() === "error") errors.push(msg.text());
        });
        await startGame(page);
        expect(errors).toEqual([]);
    });
});

/* ═════════════════════════════════════════════════════
   Keyboard Controls
   ═════════════════════════════════════════════════════ */

test.describe("Keyboard Controls", () => {
    test("pressing E performs a valid rotation and increments move count", async ({ page }) => {
        await startGame(page);
        await page.keyboard.press("e");
        // Wait for animation to complete
        await page.waitForTimeout(500);
        await expect(page.locator("#hud-moves")).toHaveText("1");
    });

    test("pressing X changes slice axis", async ({ page }) => {
        await startGame(page);
        await page.keyboard.press("x");
        await expect(page.locator("#slice-axis")).toHaveText("Y");
    });

    test("pressing Z cycles axis backwards", async ({ page }) => {
        await startGame(page);
        await page.keyboard.press("z");
        await expect(page.locator("#slice-axis")).toHaveText("W");
    });

    test("pressing 2 changes slice index", async ({ page }) => {
        await startGame(page);
        await page.keyboard.press("2");
        await expect(page.locator("#slice-idx")).toHaveText("1");
    });

    test("pressing R re-scrambles the puzzle without error", async ({ page }) => {
        await startGame(page);
        // Just verify scramble doesn't crash and move count stays at 0 (scramble doesn't count as user moves)
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await expect(page.locator("#hud-moves")).toHaveText("0");
    });

    test("pressing H toggles the controls legend", async ({ page }) => {
        await startGame(page);
        // Controls panel starts visible after init
        await expect(page.locator("#controls-panel")).toHaveClass(/visible/);
        await page.keyboard.press("h");
        await expect(page.locator("#controls-panel")).not.toHaveClass(/visible/);
        await page.keyboard.press("h");
        await expect(page.locator("#controls-panel")).toHaveClass(/visible/);
    });

    test("invalid rotation shows a toast", async ({ page }) => {
        await startGame(page);
        // X-axis + Q (XY plane) is invalid for X-axis
        await page.keyboard.press("q");
        await expect(page.locator("#toast")).toHaveClass(/show/, { timeout: 2000 });
    });
});

/* ═════════════════════════════════════════════════════
   Hint System
   ═════════════════════════════════════════════════════ */

test.describe("Hint System", () => {
    test("clicking hint button opens hint modal with trivia", async ({ page }) => {
        await startGame(page);
        // Scramble first so hint is available
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.click("#hint-btn");
        await expect(page.locator("#hint-modal")).toHaveClass(/visible/);
        await expect(page.locator("#hint-question")).not.toBeEmpty();
    });

    test("trivia choices are clickable", async ({ page }) => {
        await startGame(page);
        await page.keyboard.press("r");
        await page.waitForTimeout(200);
        await page.click("#hint-btn");
        const choices = page.locator(".hint-choice");
        await expect(choices).toHaveCount(4);
        // Click the first choice
        await choices.first().click();
        // A result should appear
        await expect(page.locator("#hint-result")).toHaveClass(/shown/);
    });
});

/* ═════════════════════════════════════════════════════
   Canvas Rendering
   ═════════════════════════════════════════════════════ */

test.describe("Canvas Rendering", () => {
    test("canvas has non-zero dimensions after init", async ({ page }) => {
        await startGame(page);
        const box = await page.locator("#render-canvas").boundingBox();
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
    });

    test("canvas is not all black (something is rendered)", async ({ page }) => {
        await startGame(page);
        // Wait for a couple of animation frames
        await page.waitForTimeout(500);
        // Take a screenshot of the canvas and check it's not uniform
        const canvas = page.locator("#render-canvas");
        const screenshot = await canvas.screenshot();
        // A non-trivial scene should produce > 5KB of PNG data
        expect(screenshot.byteLength).toBeGreaterThan(5000);
    });
});

/* ═════════════════════════════════════════════════════
   N=3 Game
   ═════════════════════════════════════════════════════ */

test.describe("N=3 Puzzle", () => {
    test("N=3 game initializes and shows HUD", async ({ page }) => {
        await startGame(page, 3);
        await expect(page.locator("#hud")).toHaveClass(/visible/);
    });

    test("N=3 slice index 3 is selectable", async ({ page }) => {
        await startGame(page, 3);
        await page.keyboard.press("3");
        await expect(page.locator("#slice-idx")).toHaveText("2");
    });
});
