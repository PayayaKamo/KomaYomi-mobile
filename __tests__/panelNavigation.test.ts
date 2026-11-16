import { stepPanelTarget } from '../src/lib/panelNavigation';

const pages = [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }];
const panelsByPage: Record<number, number[]> = {
  0: [0, 1],
  1: [],
  2: [0, 1, 2],
  3: [0],
};
const panelsOf = (pageIndex: number) => panelsByPage[pageIndex] ?? [];

describe('stepPanelTarget', () => {
  it('moves inside the current page first', () => {
    expect(stepPanelTarget(pages, panelsOf, 0, 0, 1)).toEqual({
      pageIndex: 0,
      panelIndex: 1,
    });
    expect(stepPanelTarget(pages, panelsOf, 2, 2, -1)).toEqual({
      pageIndex: 2,
      panelIndex: 1,
    });
  });

  it('continues onto the next page and skips pages without panels', () => {
    expect(stepPanelTarget(pages, panelsOf, 0, 1, 1)).toEqual({
      pageIndex: 2,
      panelIndex: 0,
    });
    expect(stepPanelTarget(pages, panelsOf, 2, 0, -1)).toEqual({
      pageIndex: 0,
      panelIndex: 1,
    });
  });

  it('returns null at both ends of the chapter', () => {
    expect(stepPanelTarget(pages, panelsOf, 3, 0, 1)).toBeNull();
    expect(stepPanelTarget(pages, panelsOf, 0, 0, -1)).toBeNull();
  });

  it('enters the nearest page when the current page has no panels', () => {
    expect(stepPanelTarget(pages, panelsOf, 1, 0, 1)).toEqual({
      pageIndex: 2,
      panelIndex: 0,
    });
    expect(stepPanelTarget(pages, panelsOf, 1, 0, -1)).toEqual({
      pageIndex: 0,
      panelIndex: 1,
    });
  });
});
