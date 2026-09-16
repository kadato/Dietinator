import { expect, test, bootAuthenticated } from "./helpers"

test.describe("calorie square swipe", () => {
  async function dragSquare(
    page: import("@playwright/test").Page,
    fromX: number,
    y: number,
    toX: number,
  ) {
    await page.mouse.move(fromX, y)
    await page.mouse.down()
    await page.mouse.move(toX, y, { steps: 12 })
    await page.mouse.up()
  }

  test("swipe left goes to next day, swipe right comes back", async ({ page }) => {
    await bootAuthenticated(page)
    const dateHeader = page.getByRole("button", { name: "Open calendar" })
    await expect(dateHeader.getByText(/^Today/)).toBeVisible()

    const square = page.getByLabel(
      "Daily calories. Swipe left for next day, right for previous day.",
    )
    await expect(square).toBeVisible()
    const box = await square.boundingBox()
    expect(box).not.toBeNull()
    const centerY = box!.y + box!.height / 2

    // Swipe left: finger travels right to left.
    await dragSquare(page, box!.x + box!.width - 10, centerY, box!.x + 10)
    await expect(dateHeader.getByText(/^Today/)).toBeHidden()

    // Swipe right: back to today.
    await dragSquare(page, box!.x + 10, centerY, box!.x + box!.width - 10)
    await expect(dateHeader.getByText(/^Today/)).toBeVisible()
  })
})
