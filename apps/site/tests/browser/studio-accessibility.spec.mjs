import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:4174" });

function formatViolations(violations) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test("Studio shell has no detectable WCAG A or AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Write Placid Studio");
  await expect(page.getByRole("button", { name: "New piece +", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(formatViolations(results.violations)).toEqual([]);
});

test("Studio primary controls are keyboard reachable", async ({ page }) => {
  await page.goto("/");
  const liveLink = page.getByRole("link", { name: "View live", exact: true });
  await page.keyboard.press("Tab");
  await expect(liveLink).toBeFocused();
  const focusStyle = await liveLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");
});
