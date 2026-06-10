import { describe, expect, it } from "vitest";
import { getPageMenuPlacement, PAGE_MENU_HEIGHT, PAGE_MENU_MARGIN, PAGE_MENU_WIDTH } from "./page-menu-placement";

describe("page menu placement", () => {
  it("centers the menu above the slide preview when there is room", () => {
    const placement = getPageMenuPlacement(
      { left: 600, top: 500, right: 760, bottom: 590, width: 160 },
      { width: 1280, height: 720 },
    );

    expect(placement.left).toBe(600 + 80 - PAGE_MENU_WIDTH / 2);
    expect(placement.top).toBe(500 - PAGE_MENU_HEIGHT - 8);
  });

  it("keeps the menu inside the viewport near the left and right edges", () => {
    expect(getPageMenuPlacement(
      { left: 4, top: 500, right: 104, bottom: 590, width: 100 },
      { width: 1280, height: 720 },
    ).left).toBe(PAGE_MENU_MARGIN);

    expect(getPageMenuPlacement(
      { left: 1230, top: 500, right: 1280, bottom: 590, width: 50 },
      { width: 1280, height: 720 },
    ).left).toBe(1280 - PAGE_MENU_WIDTH - PAGE_MENU_MARGIN);
  });

  it("falls below the slide preview when there is not enough space above", () => {
    const placement = getPageMenuPlacement(
      { left: 240, top: 60, right: 400, bottom: 150, width: 160 },
      { width: 800, height: 640 },
    );

    expect(placement.top).toBe(158);
  });

  it("uses the bottom viewport margin when neither above nor below has full room", () => {
    const placement = getPageMenuPlacement(
      { left: 240, top: 80, right: 400, bottom: 610, width: 160 },
      { width: 800, height: 640 },
    );

    expect(placement.top).toBe(640 - PAGE_MENU_HEIGHT - PAGE_MENU_MARGIN);
  });
});
