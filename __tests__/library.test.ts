import { base64ToBytes, bytesToBase64 } from '../src/lib/base64';
import { buildLibrary, naturalCompare, normalizeLangOrder } from '../src/lib/library';
import type { ProjectManifest, StoredImage } from '../src/types/project';

const manifest: ProjectManifest = {
  schemaVersion: 1,
  storageMode: 'reference',
  name: 'Demo',
  inventory: {
    volumes: [
      {
        volume: 'Demo',
        languages: ['ja', 'zh'],
        langDirs: { ja: 'Demo/ja', zh: 'Demo/zh' },
        chapters: [{ chapter: '01', pages: 2, images: 3 }],
      },
    ],
    images: [
      { volume: 'Demo', chapter: '01', pageIndex: 0, lang: 'ja', name: '001.png', path: 'Demo/ja/01/001.png' },
      { volume: 'Demo', chapter: '01', pageIndex: 0, lang: 'zh', name: '001.png', path: 'Demo/zh/01/001.png' },
      { volume: 'Demo', chapter: '01', pageIndex: 1, lang: 'ja', name: '002.png', path: 'Demo/ja/01/002.png' },
    ],
  },
};

const image = (
  pageIndex: number,
  lang: string,
  name: string,
): StoredImage => ({
  projectId: 'p1',
  volume: 'Demo',
  chapter: '01',
  pageIndex,
  lang,
  name,
  localPath: `/tmp/Demo/${lang}/01/${name}`,
  size: 1,
});

describe('base64 helpers', () => {
  it('round-trips arbitrary byte lengths', () => {
    for (let length = 0; length < 70; length += 1) {
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) bytes[i] = (i * 37 + length) % 256;
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
    }
  });
});

describe('library builder', () => {
  it('maps images to pages and fills warnings for missing languages', () => {
    const library = buildLibrary(
      manifest,
      { langOrder: ['ja', 'zh'] },
      [image(0, 'ja', '001.png'), image(0, 'zh', '001.png'), image(1, 'ja', '002.png')],
    );
    expect(library.volumes).toHaveLength(1);
    const chapter = library.volumes[0].chapters[0];
    expect(chapter.pages).toHaveLength(2);
    expect(chapter.pages[0].files.ja).toBe('/tmp/Demo/ja/01/001.png');
    expect(chapter.pages[0].files.zh).toBe('/tmp/Demo/zh/01/001.png');
    expect(chapter.pages[1].files.zh).toBeUndefined();
    expect(chapter.pages[1].warnings.length).toBeGreaterThan(0);
    expect(library.langOrder).toEqual(['ja', 'zh']);
  });

  it('honours chapter order and exclusions from the library config', () => {
    const library = buildLibrary(
      manifest,
      {
        volumes: {
          Demo: {
            title: 'Demo title',
            chapters: { '01': { title: 'Start', order: [1, 0], excluded: [0], kinds: { '1': 'cover' } } },
          },
        },
      },
      [image(0, 'ja', '001.png'), image(0, 'zh', '001.png'), image(1, 'ja', '002.png')],
    );
    const volume = library.volumes[0];
    expect(volume.title).toBe('Demo title');
    expect(volume.chapters[0].title).toBe('Start');
    expect(volume.chapters[0].pages.map((page) => page.index)).toEqual([1, 0]);
    expect(volume.chapters[0].pages[1].excluded).toBe(true);
    expect(volume.chapters[0].pages[0].kind).toBe('cover');
  });

  it('sorts natural numbers and keeps discovered languages', () => {
    expect(naturalCompare('page2', 'page10')).toBeLessThan(0);
    expect(normalizeLangOrder(['zh'], ['ja', 'zh', 'en'])).toEqual(['zh', 'ja', 'en']);
  });
});
