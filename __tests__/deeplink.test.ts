import { buildDeepLink, parseDeepLink } from '../src/lib/deeplink';

describe('parseDeepLink', () => {
  it('reads the custom-scheme reader route', () => {
    expect(
      parseDeepLink('komayomi://reader/vol1/ch1/4/original'),
    ).toEqual({
      volume: 'vol1',
      chapter: 'ch1',
      pageIndex: 3,
      view: 'original',
      panelId: null,
    });
  });

  it('reads a panel deep link and decodes each segment', () => {
    expect(
      parseDeepLink(
        'komayomi://reader/%E5%8D%B7%201/%E7%AC%AC1%E8%AF%9D/2/compare/panel/p%201',
      ),
    ).toEqual({
      volume: '卷 1',
      chapter: '第1话',
      pageIndex: 1,
      view: 'compare',
      panelId: 'p 1',
    });
  });

  it('ignores a panel segment outside the original view', () => {
    expect(
      parseDeepLink('komayomi://reader/v/c/1/original/panel/p1')?.panelId,
    ).toBeNull();
  });

  it('rejects links without a volume and chapter', () => {
    expect(parseDeepLink('komayomi://reader')).toBeNull();
    expect(parseDeepLink(null)).toBeNull();
  });
});

describe('buildDeepLink', () => {
  it('round-trips page and panel targets', () => {
    const url = buildDeepLink('卷 1', '第1话', 2, 'compare', 'p 1');
    expect(parseDeepLink(url)).toEqual({
      volume: '卷 1',
      chapter: '第1话',
      pageIndex: 2,
      view: 'compare',
      panelId: 'p 1',
    });
  });
});
