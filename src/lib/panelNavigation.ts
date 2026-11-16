/**
 * Reading-order panel stepping, shared by the compare view and the panel detail
 * view. Stepping past the first or last panel of a page continues onto the
 * neighbouring page instead of stopping at the page edge, which is what the
 * desktop reader does.
 */

export type PanelTarget = { pageIndex: number; panelIndex: number };

export function stepPanelTarget<T>(
  pages: readonly { index: number }[],
  panelsOf: (pageIndex: number) => readonly T[],
  currentPageIndex: number,
  currentPanelIndex: number,
  delta: number,
): PanelTarget | null {
  if (!pages.length || delta === 0) return null;
  const direction = delta > 0 ? 1 : -1;
  const position = pages.findIndex(page => page.index === currentPageIndex);

  if (position >= 0) {
    const panels = panelsOf(currentPageIndex);
    if (panels.length) {
      const next = currentPanelIndex + delta;
      if (next >= 0 && next < panels.length) {
        return { pageIndex: currentPageIndex, panelIndex: next };
      }
    }
  }

  const start = position >= 0 ? position + direction : direction > 0 ? 0 : pages.length - 1;
  for (let i = start; i >= 0 && i < pages.length; i += direction) {
    const panels = panelsOf(pages[i].index);
    if (!panels.length) continue;
    return {
      pageIndex: pages[i].index,
      panelIndex: direction > 0 ? 0 : panels.length - 1,
    };
  }
  return null;
}
