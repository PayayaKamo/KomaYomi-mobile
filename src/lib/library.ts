import type { Lang, Library, PageEntry, PageKind, VolumeEntry } from '../shared/types';
import { PAGE_KINDS } from '../shared/types';
import { readReadingDirection } from '../shared/format';
import type { LibraryConfig, ManifestImage, ProjectManifest } from '../types/project';
import type { StoredImage } from '../types/project';

export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const ax = a.match(re) ?? [];
  const bx = b.match(re) ?? [];
  const len = Math.min(ax.length, bx.length);
  for (let i = 0; i < len; i += 1) {
    const av = ax[i];
    const bv = bx[i];
    const an = /^\d+$/.test(av);
    const bn = /^\d+$/.test(bv);
    if (an && bn) {
      const d = parseInt(av, 10) - parseInt(bv, 10);
      if (d !== 0) return d;
    } else if (av !== bv) {
      return av.localeCompare(bv, 'zh-Hans-CN');
    }
  }
  return ax.length - bx.length;
}

export function normalizeLangOrder(value: Lang[] | undefined, discovered: readonly Lang[] = []): Lang[] {
  const known = new Set(discovered);
  const out: Lang[] = [];
  for (const lang of value ?? []) {
    if (typeof lang === 'string' && known.has(lang) && !out.includes(lang)) out.push(lang);
  }
  for (const lang of discovered) if (!out.includes(lang)) out.push(lang);
  return out;
}

const ALL_LANGS: Lang[] = ['ja', 'zh', 'en'];

/**
 * Port of the browser build's library builder, minus object URLs: `files` holds
 * absolute paths inside the imported project instead of blob URLs.
 */
export function buildLibrary(
  manifest: ProjectManifest,
  config: LibraryConfig,
  images: Pick<StoredImage, 'volume' | 'chapter' | 'pageIndex' | 'lang' | 'name' | 'localPath'>[],
): Library {
  const imageMap = new Map<string, (typeof images)[number]>();
  for (const image of images) {
    imageMap.set(`${image.volume}/${image.chapter}/${image.pageIndex}/${image.lang}`, image);
  }

  const discovered = new Set<Lang>();
  const manifestVolumes = new Map(manifest.inventory.volumes.map((volume) => [volume.volume, volume]));
  const imagesByVolume = new Map<string, ManifestImage[]>();
  for (const image of manifest.inventory.images) {
    const list = imagesByVolume.get(image.volume) ?? [];
    list.push(image);
    imagesByVolume.set(image.volume, list);
    discovered.add(image.lang);
  }

  const volumeIds = [...new Set([...manifestVolumes.keys(), ...imagesByVolume.keys()])].sort(naturalCompare);
  const volumes: VolumeEntry[] = [];

  for (const volumeId of volumeIds) {
    const inventoryVolume = manifestVolumes.get(volumeId);
    const override = config.volumes?.[volumeId] ?? {};
    const imagesOfVolume = imagesByVolume.get(volumeId) ?? [];
    const langDirs: Partial<Record<Lang, string>> = {
      ...(inventoryVolume?.langDirs as Partial<Record<Lang, string>> | undefined),
      ...(manifest.language?.volumes?.[volumeId] as Partial<Record<Lang, string>> | undefined),
      ...(override.dirs ?? {}),
    };
    const langs = new Set<Lang>();
    for (const lang of inventoryVolume?.languages ?? []) langs.add(lang);
    for (const lang of Object.keys(langDirs)) langs.add(lang);
    for (const image of imagesOfVolume) langs.add(image.lang);
    const languages = [...langs].sort((a, b) => {
      const ia = ALL_LANGS.indexOf(a);
      const ib = ALL_LANGS.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return naturalCompare(a, b);
    });
    for (const lang of languages) discovered.add(lang);

    const chapterIds = new Set<string>();
    for (const chapter of inventoryVolume?.chapters ?? []) chapterIds.add(chapter.chapter);
    for (const image of imagesOfVolume) chapterIds.add(image.chapter);

    const chapters = [...chapterIds].sort(naturalCompare).map((chapterId) => {
      const chapterOverride = override.chapters?.[chapterId] ?? {};
      const chapterImages = imagesOfVolume.filter((image) => image.chapter === chapterId);
      const declaredPages = inventoryVolume?.chapters?.find((item) => item.chapter === chapterId)?.pages ?? 0;
      const maxPage = Math.max(
        declaredPages - 1,
        chapterImages.reduce((max, image) => Math.max(max, image.pageIndex), -1),
      );
      const pages: PageEntry[] = [];
      for (let index = 0; index <= maxPage; index += 1) {
        const files: Partial<Record<Lang, string>> = {};
        const filenames: Partial<Record<Lang, string>> = {};
        const warnings: string[] = [];
        for (const lang of languages) {
          const record = imageMap.get(`${volumeId}/${chapterId}/${index}/${lang}`);
          if (!record) {
            if (chapterImages.some((image) => image.lang === lang)) {
              warnings.push(`Page ${index + 1} has no image for language "${lang}".`);
            }
            continue;
          }
          files[lang] = record.localPath;
          filenames[lang] = record.name;
        }
        pages.push({ index, files, filenames, warnings, annotated: false });
      }
      const excluded = new Set(chapterOverride.excluded ?? []);
      const ordered = chapterOverride.order?.length
        ? [
            ...chapterOverride.order
              .map((index) => pages.find((page) => page.index === index))
              .filter((page): page is PageEntry => Boolean(page)),
            ...pages.filter((page) => !chapterOverride.order!.includes(page.index)),
          ]
        : pages;
      return {
        id: `${volumeId}/${chapterId}`,
        volume: volumeId,
        chapter: chapterId,
        title: chapterOverride.title?.trim() || undefined,
        pages: ordered.map((page) => {
          const kind = chapterOverride.kinds?.[String(page.index)];
          return {
            ...page,
            excluded: excluded.has(page.index) || undefined,
            kind: kind && (PAGE_KINDS as readonly string[]).includes(kind) ? (kind as PageKind) : undefined,
          };
        }),
        warnings: [],
      };
    });

    volumes.push({
      id: volumeId,
      title: override.title?.trim() || volumeId,
      chapters,
      warnings: [],
      langDirs,
      languages,
      dirs: [...new Set(Object.values(langDirs).filter((dir): dir is string => Boolean(dir)))],
      defaultDirection: readReadingDirection(override.defaultDirection),
    });
  }

  const langOrder = normalizeLangOrder(config.langOrder, [...discovered]);
  return { root: manifest.name ?? '', languages: langOrder, langOrder, volumes };
}
