import { strFromU8, unzipSync } from 'fflate';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { pick, keepLocalCopy, pickDirectory, types } from '@react-native-documents/picker';
import type { PageDoc } from '../shared/types';
import { migrateManifestV0, migratePageV0 } from '../shared/migrations';
import type { LibraryConfig, ManifestImage, ProjectManifest, StoredImage } from '../types/project';
import { buildLibrary } from './library';
import { base64ToBytes, bytesToBase64 } from './base64';
import { copyImageDirectory, fileUri, projectDirectory, ensureDir, archiveScratchDirectory, removeDirectory, extractArchive, writeBase64File } from './files';
import { insertImages, insertPages, insertProject } from './db';

export type ImportPhase = 'reading' | 'extracting' | 'images' | 'saving';

export type ImportProgress = (phase: ImportPhase, done: number, total: number) => void;

type PreparedProject = {
  id: string;
  name: string;
  storageMode: 'packaged' | 'reference';
  sourceFile: string;
  importedAt: string;
  directory: string;
  manifest: ProjectManifest;
  config: LibraryConfig;
  pageDocs: PageDoc[];
  images: StoredImage[];
  missing: string[];
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();

const baseName = (value: string) => value.replace(/\\/g, '/').split('/').pop() ?? value;

const stripScheme = (value: string) => value.replace(/^file:\/\//, '');

const makeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function normalizeManifest(raw: unknown): ProjectManifest {
  if (!isRecord(raw)) throw new Error('manifest.json is missing or not a JSON object.');
  const version = Number(raw.schemaVersion) || 0;
  const base = version < 1 ? migrateManifestV0(raw) : raw;
  if (!isRecord(base.inventory)) {
    throw new Error('manifest.json has no inventory. This file is not a KomaYomi project.');
  }
  const manifest = base as unknown as ProjectManifest;
  manifest.storageMode = manifest.storageMode === 'packaged' ? 'packaged' : 'reference';
  manifest.schemaVersion = 1;
  manifest.inventory.images = Array.isArray(manifest.inventory.images) ? manifest.inventory.images : [];
  manifest.inventory.volumes = Array.isArray(manifest.inventory.volumes) ? manifest.inventory.volumes : [];
  manifest.language = isRecord(manifest.language) ? manifest.language : { volumes: {}, resolved: {} };
  for (const image of manifest.inventory.images) {
    image.volume = String(image.volume ?? '');
    image.chapter = String(image.chapter ?? '');
    image.pageIndex = Number(image.pageIndex) || 0;
    image.lang = String(image.lang ?? 'ja');
    image.name = String(image.name ?? '');
    if (image.path) image.path = normalizePath(String(image.path));
  }
  return manifest;
}

/**
 * Unpacked archive access. Android extracts the zip natively, so only the small JSON
 * files are read through JS and the images are moved on disk; the in-memory fallback
 * keeps iOS (no native extractor) working with the previous approach.
 */
type ArchiveContents = {
  names: string[];
  text(name: string): Promise<string>;
  /** Move one entry to `target` and return its size in bytes. */
  materialize(name: string, target: string): Promise<number>;
  dispose(): Promise<void>;
};

function archiveError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not read the project archive: ${message}`);
}

async function openArchiveInMemory(archivePath: string): Promise<ArchiveContents> {
  let files: Record<string, Uint8Array>;
  try {
    const base64 = await RNFS.readFile(archivePath, 'base64');
    files = unzipSync(base64ToBytes(base64));
  } catch (error) {
    throw archiveError(error);
  }
  return {
    names: Object.keys(files),
    text: async (name) => strFromU8(files[name]),
    materialize: async (name, target) => {
      const entry = files[name];
      // Drop the entry as soon as it is written so a large archive is not held twice.
      delete files[name];
      await writeBase64File(target, bytesToBase64(entry));
      return entry.byteLength;
    },
    dispose: async () => undefined,
  };
}

async function openArchive(archivePath: string, scratch: string): Promise<ArchiveContents> {
  let entries: Awaited<ReturnType<typeof extractArchive>>;
  try {
    entries = await extractArchive(archivePath, scratch);
  } catch (error) {
    throw archiveError(error);
  }
  if (!entries) return openArchiveInMemory(archivePath);

  const sizes = new Map(entries.map((entry) => [entry.name, entry.size]));
  return {
    names: [...sizes.keys()],
    text: (name) => RNFS.readFile(`${scratch}/${name}`, 'utf8'),
    materialize: async (name, target) => {
      await RNFS.moveFile(`${scratch}/${name}`, target);
      return sizes.get(name) ?? 0;
    },
    dispose: () => removeDirectory(scratch),
  };
}

async function readConfig(contents: ArchiveContents): Promise<LibraryConfig> {
  const key = contents.names.find((name) => name === 'config/library.json' || name.endsWith('/config/library.json'));
  if (!key) return {};
  try {
    const parsed: unknown = JSON.parse(await contents.text(key));
    if (isRecord(parsed) && isRecord(parsed.data)) return parsed.data as LibraryConfig;
    return isRecord(parsed) ? (parsed as LibraryConfig) : {};
  } catch {
    return {};
  }
}

async function readPageDocs(contents: ArchiveContents, warnings: string[]): Promise<PageDoc[]> {
  const entries = contents.names.filter((name) => name.includes('pages/') && name.endsWith('.json'));
  const docs: PageDoc[] = [];
  for (const name of entries) {
    const rel = name.slice(name.indexOf('pages/') + 'pages/'.length, -'.json'.length);
    const parts = rel.split('/');
    const pageIndex = Number(parts[parts.length - 1]);
    if (!Number.isFinite(pageIndex)) {
      warnings.push(`Skipped a page file with an invalid index: ${name}`);
      continue;
    }
    try {
      const parsed = JSON.parse(await contents.text(name)) as Record<string, unknown>;
      const normalized = Number(parsed.schemaVersion) >= 1 ? parsed : migratePageV0(parsed);
      const doc = normalized as unknown as PageDoc;
      doc.schemaVersion = 1;
      doc.volume = doc.volume || parts.slice(0, -2).join('/');
      doc.chapter = doc.chapter || (parts.length >= 2 ? parts[parts.length - 2] : '');
      doc.pageIndex = pageIndex;
      doc.panels = Array.isArray(doc.panels) ? doc.panels : [];
      doc.notes = Array.isArray(doc.notes) ? doc.notes : [];
      doc.offsets = isRecord(doc.offsets) ? doc.offsets : {};
      doc.panelOffsets = isRecord(doc.panelOffsets) ? doc.panelOffsets : {};
      doc.readingDirection = doc.readingDirection ?? 'rtl';
      docs.push(doc);
    } catch {
      warnings.push(`Skipped an invalid page file: ${name}`);
    }
  }
  return docs;
}

export type PickedArchive = { path: string; name: string };

/** Copy a picked `.mnproj` into the cache and return its local path, or `null` when the user cancels. */
export async function pickProjectArchive(): Promise<PickedArchive | null> {
  try {
    const [picked] = await pick({ type: [types.allFiles], mode: 'import' });
    if (!picked?.uri) return null;
    const name = picked.name ?? `project-${Date.now()}.mnproj`;
    if (!/\.mnproj$/i.test(name)) {
      throw new Error('Please pick a KomaYomi project file (.mnproj).');
    }
    const [copy] = await keepLocalCopy({ files: [{ uri: picked.uri, fileName: name }], destination: 'cachesDirectory' });
    if (!copy || copy.status !== 'success') {
      throw new Error(copy && 'copyError' in copy ? copy.copyError : 'Could not read the picked project.');
    }
    return { path: stripScheme(copy.localUri), name };
  } catch (error) {
    if (isRecord(error) && error.code === 'OPERATION_CANCELED') return null;
    throw error;
  }
}

function findArchiveEntry(names: Set<string>, assetPath: string | undefined): string | undefined {
  if (!assetPath) return undefined;
  const normalized = assetPath.replace(/\\/g, '/');
  if (names.has(normalized)) return normalized;
  const fallback = `assets/${baseName(normalized)}`;
  return names.has(fallback) ? fallback : undefined;
}

/**
 * Unpack an archive and prepare the project. Packaged images are moved next to the
 * project; reference projects wait for `attachReferenceFolder`.
 */
export async function prepareProject(
  source: PickedArchive,
  onProgress: ImportProgress = () => undefined,
  overrides: { id?: string; name?: string } = {},
): Promise<PreparedProject> {
  const id = overrides.id ?? makeId();
  const directory = projectDirectory(id);
  onProgress('reading', 0, 1);
  onProgress('extracting', 0, 1);
  const contents = await openArchive(source.path, archiveScratchDirectory(id));

  try {
    if (!contents.names.includes('manifest.json')) {
      throw new Error('manifest.json is missing. This file is not a KomaYomi project (.mnproj).');
    }
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(await contents.text('manifest.json'));
    } catch {
      throw new Error('manifest.json is not valid JSON.');
    }
    const manifest = normalizeManifest(manifestRaw);
    const config = await readConfig(contents);
    const warnings: string[] = [];
    if (manifest.storageMode === 'reference') {
      warnings.push('This is a reference project. Pick its image folder to attach the original pages.');
    }
    const pageDocs = await readPageDocs(contents, warnings);

    const name = overrides.name ?? (manifest.name?.trim() || source.name.replace(/\.mnproj$/i, ''));
    const images: StoredImage[] = [];
    const missing: string[] = [];

    if (manifest.storageMode === 'packaged') {
      await ensureDir(`${directory}/assets`);
      const entries = new Set(contents.names);
      const total = manifest.inventory.images.length;
      let done = 0;
      for (const image of manifest.inventory.images) {
        const assetPath = image.asset ?? '';
        const entryName = findArchiveEntry(entries, assetPath);
        if (!entryName) {
          missing.push(`${image.volume}/${image.chapter}/${image.name}`);
        } else {
          const assetName = baseName(assetPath) || `${image.volume}-${image.chapter}-${image.pageIndex}-${image.lang}`;
          const localPath = `${directory}/assets/${assetName}`;
          const size = await contents.materialize(entryName, localPath);
          images.push({
            projectId: id,
            volume: image.volume,
            chapter: image.chapter,
            pageIndex: image.pageIndex,
            lang: image.lang,
            name: image.name,
            localPath,
            size,
          });
        }
        done += 1;
        if (done % 4 === 0 || done === total) onProgress('images', done, total);
      }
    }

    if (missing.length) {
      warnings.push(
        `${missing.length} image${missing.length === 1 ? '' : 's'} could not be found in the archive.`,
      );
    }

    return {
      id,
      name,
      storageMode: manifest.storageMode,
      sourceFile: source.name,
      importedAt: new Date().toISOString(),
      directory,
      manifest,
      config,
      pageDocs,
      images,
      missing,
      warnings,
    };
  } catch (error) {
    // Do not leave a half-written project folder behind when parsing fails.
    await removeDirectory(directory);
    throw error;
  } finally {
    await contents.dispose();
  }
}

function pickImageFile(
  image: ManifestImage,
  byPath: Map<string, { relativePath: string; name: string; size: number }>,
  byName: Map<string, { relativePath: string; name: string; size: number }[]>,
) {
  const wanted = image.path ? normalizePath(image.path) : '';
  if (wanted) {
    const exact = byPath.get(wanted);
    if (exact) return exact;
    for (const [path, file] of byPath) {
      if (path.endsWith(`/${wanted}`)) return file;
    }
  }
  const candidates = byName.get(image.name.toLowerCase()) ?? [];
  if (candidates.length === 1) return candidates[0];
  if (image.size) {
    const sized = candidates.find((file) => file.size === image.size);
    if (sized) return sized;
  }
  return candidates[0];
}

/**
 * Ask for the original image folder and copy the matching pages into the project.
 * Returns `false` when the user cancels; the project then loads with placeholders.
 */
export async function attachReferenceFolder(
  prepared: PreparedProject,
  onProgress: ImportProgress = () => undefined,
): Promise<boolean> {
  let picked: { uri: string };
  try {
    picked = await pickDirectory({ requestLongTermAccess: false });
  } catch (error) {
    if (isRecord(error) && error.code === 'OPERATION_CANCELED') {
      prepared.warnings.push('No image folder was picked, so reference pages have no images yet.');
      return false;
    }
    throw error;
  }

  const destination = `${prepared.directory}/ref`;
  await ensureDir(destination);
  const copied = await copyImageDirectory(picked.uri, destination);
  const byPath = new Map<string, (typeof copied)[number]>();
  const byName = new Map<string, (typeof copied)[number][]>();
  for (const file of copied) {
    const rel = normalizePath(file.relativePath);
    byPath.set(rel, file);
    const list = byName.get(file.name.toLowerCase()) ?? [];
    list.push(file);
    byName.set(file.name.toLowerCase(), list);
  }

  prepared.images = [];
  prepared.missing = [];
  const total = prepared.manifest.inventory.images.length;
  let done = 0;
  for (const image of prepared.manifest.inventory.images) {
    const match = pickImageFile(image, byPath, byName);
    if (!match) {
      prepared.missing.push(`${image.volume}/${image.chapter}/${image.name}`);
    } else {
      prepared.images.push({
        projectId: prepared.id,
        volume: image.volume,
        chapter: image.chapter,
        pageIndex: image.pageIndex,
        lang: image.lang,
        name: image.name,
        localPath: `${destination}/${match.relativePath}`,
        size: match.size,
      });
    }
    done += 1;
    if (done % 4 === 0 || done === total) onProgress('images', done, total);
  }

  if (prepared.missing.length) {
    prepared.warnings.push(
      `${prepared.missing.length} page image${prepared.missing.length === 1 ? '' : 's'} were not found in the picked folder.`,
    );
  }
  return true;
}

/** Build the library, persist everything and return the stored project. */
export async function finalizePreparedProject(
  prepared: PreparedProject,
  onProgress: ImportProgress = () => undefined,
): Promise<import('../types/project').ImportResult> {
  const library = buildLibrary(prepared.manifest, prepared.config, prepared.images);
  const project = {
    id: prepared.id,
    name: prepared.name,
    storageMode: prepared.storageMode,
    sourceFile: prepared.sourceFile,
    importedAt: prepared.importedAt,
    directory: prepared.directory,
    manifest: prepared.manifest,
    config: prepared.config,
    library,
    warnings: prepared.warnings,
  };
  onProgress('saving', 0, 1);
  await insertProject(project);
  await insertImages(prepared.images);
  await insertPages(prepared.id, prepared.pageDocs);
  onProgress('saving', 1, 1);
  return {
    project,
    pages: prepared.pageDocs.length,
    images: prepared.images.length,
    missingImages: prepared.missing.length,
    warnings: prepared.warnings,
  };
}

/** Full import flow used by the home screen. */
export async function importPickedProject(
  onProgress: ImportProgress = () => undefined,
): Promise<import('../types/project').ImportResult | null> {
  const archive = await pickProjectArchive();
  if (!archive) return null;
  const prepared = await prepareProject(archive, onProgress);
  if (prepared.storageMode === 'reference') {
    await attachReferenceFolder(prepared, onProgress);
  }
  return finalizePreparedProject(prepared, onProgress);
}

/** Absolute URI helper shared by the reader. */
export const imageUri = fileUri;
