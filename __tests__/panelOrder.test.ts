import { sortReadingOrder } from '../src/shared/panelOrder';
import type { Panel, ReadingDirection } from '../src/shared/types';

const grid: Panel[] = [
  { id: 'tl', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
  { id: 'tr', rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 } },
  { id: 'bl', rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
  { id: 'br', rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
];

const order = (direction: ReadingDirection) =>
  sortReadingOrder(grid, direction, panel => panel.rect).map(panel => panel.id);

describe('sortReadingOrder', () => {
  it('reads horizontal rows right-to-left for rtl and horizontal-rl', () => {
    expect(order('rtl')).toEqual(['tr', 'tl', 'br', 'bl']);
    expect(order('horizontal-rl')).toEqual(['tr', 'tl', 'br', 'bl']);
  });

  it('reads horizontal rows left-to-right for ltr and horizontal-lr', () => {
    expect(order('ltr')).toEqual(['tl', 'tr', 'bl', 'br']);
    expect(order('horizontal-lr')).toEqual(['tl', 'tr', 'bl', 'br']);
  });

  it('reads vertical columns right-to-left for ttb and vertical-rl', () => {
    expect(order('ttb')).toEqual(['tr', 'br', 'tl', 'bl']);
    expect(order('vertical-rl')).toEqual(['tr', 'br', 'tl', 'bl']);
  });

  it('reads vertical columns left-to-right for vertical-lr', () => {
    expect(order('vertical-lr')).toEqual(['tl', 'bl', 'tr', 'br']);
  });

  it('honours explicit panel numbers before geometry', () => {
    const numbered: Panel[] = [
      { id: 'a', rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, number: 3 },
      { id: 'b', rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 }, number: 1 },
      { id: 'c', rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 }, number: 2 },
    ];
    expect(
      sortReadingOrder(numbered, 'ltr', panel => panel.rect).map(
        panel => panel.id,
      ),
    ).toEqual(['b', 'c', 'a']);
  });
});
