import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/a-place-of-your-own.html",
  "/about.html",
  "/links.html",
  "/now.html",
];

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

for (const route of publicRoutes) {
  test(`${route} has no detectable WCAG A or AA violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(formatViolations(results.violations)).toEqual([]);
  });
}

test("keyboard focus and theme state remain visible and persistent", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Switch to dark theme" });
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await toggle.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: /A place of your own/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const width of [390, 768, 900, 1200, 1440]) {
  test(`article reflows without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/a-place-of-your-own.html");
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      articleRight: document.querySelector(".article-column")?.getBoundingClientRect().right,
    }));
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);
    expect(geometry.articleRight).toBeLessThanOrEqual(width - 23);
  });
}
