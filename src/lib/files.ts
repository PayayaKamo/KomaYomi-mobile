import * as RNFS from '@dr.pogodin/react-native-fs';
import { NativeModules, Platform } from 'react-native';

export const projectsRoot = `${RNFS.DocumentDirectoryPath}/projects`;

export function projectDirectory(projectId: string): string {
  return `${projectsRoot}/${projectId}`;
}

/** RN `<Image>` needs a URI scheme on Android; plain absolute paths are not enough. */
export function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export async function ensureDir(path: string): Promise<void> {
  try {
    await RNFS.mkdir(path);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/exist/i.test(message)) throw error;
  }
}

export async function writeBase64File(path: string, base64: string): Promise<void> {
  const slash = path.lastIndexOf('/');
  if (slash > 0) await ensureDir(path.slice(0, slash));
  await RNFS.writeFile(path, base64, 'base64');
}

export async function removeDirectory(path: string): Promise<void> {
  try {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
  } catch {
    // A missing project folder must never block deleting the database row.
  }
}

export type CopiedFile = { relativePath: string; name: string; size: number };

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

/**
 * iOS equivalent of the Android `KomaFiles.copyDirectory` module: walk the picked
 * folder with RNFS and copy images into the project directory, preserving paths.
 */
async function copyDirectoryIos(uri: string, destination: string): Promise<CopiedFile[]> {
  const decoded = decodeURIComponent(uri.replace(/^file:\/\//, ''));
  const copied: CopiedFile[] = [];

  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await RNFS.readDir(dir);
    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(entry.path, relativePath);
        continue;
      }
      if (!IMAGE_EXTENSIONS.test(entry.name)) continue;
      const target = `${destination}/${relativePath}`;
      await ensureDir(target.slice(0, target.lastIndexOf('/')));
      await RNFS.copyFile(entry.path, target);
      copied.push({ relativePath, name: entry.name, size: Number(entry.size) || 0 });
    }
  };

  await walk(decoded, '');
  return copied;
}

type KomaFilesNative = {
  copyDirectory(uri: string, destination: string): Promise<CopiedFile[]>;
};

function nativeFiles(): KomaFilesNative | null {
  if (Platform.OS !== 'android') return null;
  return (NativeModules as Record<string, KomaFilesNative | undefined>).KomaFiles ?? null;
}

/**
 * Copy a picked folder into the project so reference-mode projects keep working
 * after the picker permission expires. Android tree URIs need the native module;
 * iOS reads the folder directly through RNFS.
 */
export async function copyImageDirectory(uri: string, destination: string): Promise<CopiedFile[]> {
  if (Platform.OS === 'android') {
    const files = nativeFiles();
    if (!files) throw new Error('The Android folder reader is not linked in this build.');
    return files.copyDirectory(uri, destination);
  }
  return copyDirectoryIos(uri, destination);
}
