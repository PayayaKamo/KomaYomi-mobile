import type {
  Note,
  NoteImage,
  NoteSource,
  Panel,
  PanelRect,
} from '../shared/types';

/**
 * Pure panel geometry, vendored from the desktop app (`src/lib/geometry.ts`).
 * The DOM helpers (`pointToNorm`) and the i18n import are intentionally left out;
 * everything here works on plain numbers so it can be reused by the native reader.
 */

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function normalizeRect(rect: PanelRect): PanelRect {
  const x = clamp01(rect.x);
  const y = clamp01(rect.y);
  const w = Math.min(1 - x, Math.max(0.02, rect.w));
  const h = Math.min(1 - y, Math.max(0.02, rect.h));
  return { x, y, w, h };
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'move';

export function applyDrag(start: PanelRect, handle: ResizeHandle, dx: number, dy: number, minSize = 0.02): PanelRect {
  let { x, y, w, h } = start;
  if (handle === 'move') {
    x = Math.min(1 - w, Math.max(0, x + dx));
    y = Math.min(1 - h, Math.max(0, y + dy));
    return { x, y, w, h };
  }
  if (handle.includes('w')) {
    const nx = Math.min(x + w - minSize, Math.max(0, x + dx));
    w += x - nx;
    x = nx;
  }
  if (handle.includes('e')) {
    w = Math.min(1 - x, Math.max(minSize, w + dx));
  }
  if (handle.includes('n')) {
    const ny = Math.min(y + h - minSize, Math.max(0, y + dy));
    h += y - ny;
    y = ny;
  }
  if (handle.includes('s')) {
    h = Math.min(1 - y, Math.max(minSize, h + dy));
  }
  return { x, y, w, h };
}

export function unionRects(rects: PanelRect[]): PanelRect {
  if (!rects.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function splitRect(rect: PanelRect, orientation: 'v' | 'h', cuts: number[]): PanelRect[] {
  const points = [0, ...cuts, 1];
  const pieces: PanelRect[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    pieces.push(
      orientation === 'v'
        ? { x: rect.x + rect.w * from, y: rect.y, w: rect.w * (to - from), h: rect.h }
        : { x: rect.x, y: rect.y + rect.h * from, w: rect.w, h: rect.h * (to - from) },
    );
  }
  return pieces;
}

/** Freeze a sequence into explicit 1..N numbers. */
export function renumberPanels(panels: Panel[]): Panel[] {
  return panels.map((panel, index) => ({ ...panel, number: index + 1 }));
}

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function newNote(
  scope: 'page' | 'panel',
  panelId: string | null,
  text: string,
  tags: string[],
  source?: NoteSource,
  images?: NoteImage[],
): Note {
  const now = new Date().toISOString();
  return {
    id: uid('n'),
    scope,
    panelId,
    text,
    tags,
    source,
    images: images?.length ? images : undefined,
    createdAt: now,
    updatedAt: now,
  };
}
