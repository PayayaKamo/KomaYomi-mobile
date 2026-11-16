import { Image } from 'react-native';

type Size = { width: number; height: number };

const cache = new Map<string, Size | null>();
const pending = new Map<string, Promise<Size | null>>();

/**
 * Intrinsic size of a local image, cached per URI.
 *
 * Panel scope needs the natural width/height to translate the normalized panel
 * rectangle into pixel offsets; the page data does not carry image dimensions.
 */
export function loadImageSize(uri: string): Promise<Size | null> {
  if (cache.has(uri)) return Promise.resolve(cache.get(uri) ?? null);
  const running = pending.get(uri);
  if (running) return running;

  const request = new Promise<Size | null>(resolve => {
    Image.getSize(
      uri,
      (width, height) => {
        const size = { width, height };
        cache.set(uri, size);
        pending.delete(uri);
        resolve(size);
      },
      () => {
        cache.set(uri, null);
        pending.delete(uri);
        resolve(null);
      },
    );
  });
  pending.set(uri, request);
  return request;
}
