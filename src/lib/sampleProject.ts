import * as RNFS from '@dr.pogodin/react-native-fs';
import type { ImportResult, StoredProject } from '../types/project';
import { ensureDir } from './files';
import { finalizePreparedProject, prepareProject, type ImportPhase } from './projectImport';

/**
 * The demo library is 65 MB of page images, so it is not bundled in the APK: the app
 * downloads it once from a dedicated GitHub Release, keeps the archive in the documents
 * folder and imports from that cached copy afterwards (also when offline).
 *
 * Bump `SAMPLE_ARCHIVE_FILE` and publish a new `demo-library-vN` release when the demo
 * content changes; the old cache then stays untouched and is ignored.
 */
export const SAMPLE_PROJECT_ID = 'demo-library';
export const SAMPLE_PROJECT_NAME = 'KomaYomi Sample';
const SAMPLE_ARCHIVE_FILE = 'demo-project-v1.mnproj';
const SAMPLE_DOWNLOAD_URL =
  'https://github.com/PayayaKamo/KomaYomi-mobile/releases/download/demo-library-v1/demo-project.mnproj';
/** Approximate download size, shown before the first download starts. */
export const SAMPLE_APPROX_BYTES = 68_598_075;

export function sampleArchivePath(): string {
  return `${RNFS.DocumentDirectoryPath}/samples/${SAMPLE_ARCHIVE_FILE}`;
}

/** The demo is a regular project row, marked by its fixed id so it is listed and deletable. */
export function isSampleProject(project: Pick<StoredProject, 'id'>): boolean {
  return project.id === SAMPLE_PROJECT_ID;
}

export function findSampleProject(projects: StoredProject[]): StoredProject | null {
  return projects.find(isSampleProject) ?? null;
}

export class SampleCancelledError extends Error {
  constructor() {
    super('The sample project download was cancelled.');
    this.name = 'SampleCancelledError';
  }
}

export type SampleProgress =
  | { kind: 'download'; received: number; total: number }
  | { kind: 'import'; phase: ImportPhase; done: number; total: number };

export type SampleImport = {
  promise: Promise<ImportResult>;
  /** Aborts a running download; importing itself cannot be interrupted. */
  cancel: () => void;
};

type DownloadControl = { cancelled: boolean; jobId: number | null };

/** Stops a leftover job so a retry never writes to the same file twice. */
let activeJobId: number | null = null;

const discard = async (path: string): Promise<void> => {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {
    // A partial file that cannot be removed is retried on the next download.
  }
};

export async function hasSampleArchive(): Promise<boolean> {
  const path = sampleArchivePath();
  try {
    if (!(await RNFS.exists(path))) return false;
    const info = await RNFS.stat(path);
    // A zip always starts with "PK\x03\x04"; anything else is a truncated download.
    const head = Number(info.size) >= 1024 ? await RNFS.read(path, 4, 0, 'base64') : '';
    if (head !== 'UEsDBA==') {
      await discard(path);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function downloadArchive(
  control: DownloadControl,
  onProgress: (progress: SampleProgress) => void,
): Promise<void> {
  const target = sampleArchivePath();
  // Download beside the cache entry so an interrupted transfer never looks like a cached file.
  const partial = `${target}.part`;
  await ensureDir(target.slice(0, target.lastIndexOf('/')));
  if (activeJobId !== null) {
    RNFS.stopDownload(activeJobId);
    activeJobId = null;
  }
  await discard(partial);
  await discard(target);

  const { jobId, promise } = RNFS.downloadFile({
    fromUrl: SAMPLE_DOWNLOAD_URL,
    toFile: partial,
    connectionTimeout: 30000,
    readTimeout: 60000,
    progressInterval: 400,
    progress: (progress) => {
      if (control.cancelled) return;
      onProgress({ kind: 'download', received: progress.bytesWritten, total: progress.contentLength });
    },
  });
  control.jobId = jobId;
  activeJobId = jobId;

  let statusCode = 0;
  try {
    const result = await promise;
    statusCode = result.statusCode;
  } catch (error) {
    if (control.cancelled) {
      await discard(partial);
      throw new SampleCancelledError();
    }
    await discard(partial);
    throw new Error(`The sample project download failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    control.jobId = null;
    if (activeJobId === jobId) activeJobId = null;
  }

  if (control.cancelled) {
    await discard(partial);
    throw new SampleCancelledError();
  }
  if (statusCode < 200 || statusCode >= 300) {
    await discard(partial);
    throw new Error(`The sample project download failed (HTTP ${statusCode}).`);
  }
  const info = await RNFS.stat(partial).catch(() => null);
  if (!info || Number(info.size) < 1024) {
    await discard(partial);
    throw new Error('The downloaded sample project is incomplete.');
  }
  await RNFS.moveFile(partial, target).catch(async (error: unknown) => {
    await discard(partial);
    throw new Error(`The sample project could not be saved: ${error instanceof Error ? error.message : String(error)}`);
  });
}

/**
 * Import the demo library: reuse an existing import, otherwise download (when not cached)
 * and import. The cached archive is kept after the project is deleted, so reopening it
 * works offline.
 */
export function importSampleProject(
  onProgress: (progress: SampleProgress) => void = () => undefined,
): SampleImport {
  const control: DownloadControl = { cancelled: false, jobId: null };
  const cancel = () => {
    control.cancelled = true;
    if (control.jobId !== null) {
      RNFS.stopDownload(control.jobId);
      control.jobId = null;
    }
  };

  const promise = (async (): Promise<ImportResult> => {
    if (!(await hasSampleArchive())) {
      onProgress({ kind: 'download', received: 0, total: 0 });
      await downloadArchive(control, onProgress);
    }
    if (control.cancelled) throw new SampleCancelledError();

    const prepared = await prepareProject(
      { path: sampleArchivePath(), name: SAMPLE_ARCHIVE_FILE },
      (phase, done, total) => onProgress({ kind: 'import', phase, done, total }),
      { id: SAMPLE_PROJECT_ID, name: SAMPLE_PROJECT_NAME },
    );
    return finalizePreparedProject(prepared, (phase, done, total) =>
      onProgress({ kind: 'import', phase, done, total }),
    );
  })();

  return { promise, cancel };
}
