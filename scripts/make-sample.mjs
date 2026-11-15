// Builds demo .mnproj archives from the desktop sample library.
// Usage: node scripts/make-sample.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const demo = resolve(root, '../KomaYomi/samples/demo-library');
const outDir = join(root, 'samples');
const langs = ['ja', 'zh', 'en'];
const volume = 'Star Cafe';
const chapter = '01';
const pageNames = ['001.png', '002.png', '003.png'];

mkdirSync(outDir, { recursive: true });

const imageEntries = [];
for (const lang of langs) {
  for (let index = 0; index < pageNames.length; index += 1) {
    const name = pageNames[index];
    const relative = `${volume}/${lang}/${chapter}/${name}`;
    const bytes = new Uint8Array(readFileSync(join(demo, volume, lang, chapter, name)));
    const sha1 = createHash('sha1').update(bytes).digest('hex');
    imageEntries.push({
      volume,
      chapter,
      pageIndex: index,
      lang,
      name,
      sha1,
      size: bytes.byteLength,
      path: relative,
      assetName: `assets/${sha1}.png`,
      bytes,
    });
  }
}

const pageDocs = pageNames.map((_, index) => ({
  schemaVersion: 1,
  volume,
  chapter,
  pageIndex: index,
  panels: [],
  notes: [],
  offsets: {},
  alignMode: 'page',
  panelOffsets: {},
  readingDirection: 'rtl',
  updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
}));

const config = {
  data: {
    volumes: {
      [volume]: {
        title: volume,
        dirs: { ja: `${volume}/ja`, zh: `${volume}/zh`, en: `${volume}/en` },
        defaultDirection: 'rtl',
        chapters: { [chapter]: { title: 'Chapter 1', order: [0, 1, 2] } },
      },
    },
    langOrder: langs,
  },
};

function build(storageMode) {
  const manifest = {
    schemaVersion: 1,
    storageMode,
    name: volume,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    appVersion: 'mobile-demo',
    language: {
      volumes: { [volume]: { ja: `${volume}/ja`, zh: `${volume}/zh`, en: `${volume}/en` } },
      resolved: {},
    },
    inventory: {
      volumes: [
        {
          volume,
          languages: langs,
          langDirs: { ja: `${volume}/ja`, zh: `${volume}/zh`, en: `${volume}/en` },
          chapters: [{ chapter, pages: pageNames.length, images: langs.length * pageNames.length }],
        },
      ],
      images: imageEntries.map((image) => ({
        volume,
        chapter,
        pageIndex: image.pageIndex,
        lang: image.lang,
        name: image.name,
        sha1: image.sha1,
        size: image.size,
        ...(storageMode === 'packaged' ? { asset: image.assetName } : { path: image.path }),
      })),
      pageCount: pageNames.length,
    },
  };

  const files = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'config/library.json': strToU8(JSON.stringify(config, null, 2)),
  };
  for (const doc of pageDocs) {
    files[`pages/${volume}/${chapter}/${doc.pageIndex}.json`] = strToU8(JSON.stringify(doc, null, 2));
  }
  if (storageMode === 'packaged') {
    for (const image of imageEntries) {
      files[image.assetName] = image.bytes;
    }
  }
  return zipSync(files, { level: 6 });
}

const packaged = build('packaged');
const reference = build('reference');
const packagedPath = join(outDir, 'star-cafe-packaged.mnproj');
const referencePath = join(outDir, 'star-cafe-reference.mnproj');
writeFileSync(packagedPath, packaged);
writeFileSync(referencePath, reference);

const androidAssets = join(root, 'android/app/src/main/assets/samples');
mkdirSync(androidAssets, { recursive: true });
copyFileSync(packagedPath, join(androidAssets, 'star-cafe-packaged.mnproj'));

const size = (path) => `${(statSync(path).size / 1024).toFixed(1)} KB`;
console.log(`wrote ${packagedPath} (${size(packagedPath)})`);
console.log(`wrote ${referencePath} (${size(referencePath)})`);
console.log(`bundled ${join(androidAssets, 'star-cafe-packaged.mnproj')}`);
