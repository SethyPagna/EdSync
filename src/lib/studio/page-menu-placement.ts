export type PageMenuRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
};

export type PageMenuViewport = {
  width: number;
  height: number;
};

export type PageMenuPlacement = {
  left: number;
  top: number;
};

export const PAGE_MENU_WIDTH = 224;
export const PAGE_MENU_HEIGHT = 260;
export const PAGE_MENU_MARGIN = 12;

export function getPageMenuPlacement(
  rect: PageMenuRect,
  viewport: PageMenuViewport,
  menuWidth = PAGE_MENU_WIDTH,
  menuHeight = PAGE_MENU_HEIGHT,
  margin = PAGE_MENU_MARGIN,
): PageMenuPlacement {
  const maxLeft = viewport.width - menuWidth - margin;
  const preferredTop = rect.top - menuHeight - 8;
  const fallbackTop = rect.bottom + 8;
  const top = preferredTop >= margin
    ? preferredTop
    : Math.min(fallbackTop, viewport.height - menuHeight - margin);

  return {
    left: Math.max(margin, Math.min(rect.left + rect.width / 2 - menuWidth / 2, maxLeft)),
    top: Math.max(margin, top),
  };
}
