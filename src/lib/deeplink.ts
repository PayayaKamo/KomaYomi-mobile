/**
 * Custom-scheme deep links, mirroring the desktop hash routes:
 * `komayomi://reader/<volume>/<chapter>/<page>/<view>[/panel/<panelId>]`.
 *
 * The reader has two views (`compare` and `original`), and the panel detail view
 * is only addressable from the compare view, so a shared link restores exactly
 * the same page and panel position on a cold start.
 */

export type ReaderView = 'compare' | 'original';

export type DeepLink = {
  volume: string;
  chapter: string;
  /** Zero-based page index. */
  pageIndex: number;
  view: ReaderView;
  /** Panel detail target, or null for the normal compare view. */
  panelId: string | null;
};

export function parseDeepLink(raw: string | null | undefined): DeepLink | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value.startsWith('#')) value = value.slice(1);
  const scheme = /^[a-z][a-z0-9+.-]*:\/\//i.exec(value);
  if (scheme) value = value.slice(scheme[0].length);
  value = value.replace(/^\/+/, '');
  if (!value) return null;

  const parts = value.split('/');
  if (parts[0] === 'reader' || parts[0] === 'open') parts.shift();
  const [volume, chapter, pageNo, mode, sub, panelId] = parts;
  if (!volume || !chapter) return null;

  const view: ReaderView = mode === 'original' ? 'original' : 'compare';
  return {
    volume: decodeURIComponent(volume),
    chapter: decodeURIComponent(chapter),
    pageIndex: Math.max(0, (Number.parseInt(pageNo ?? '1', 10) || 1) - 1),
    view,
    panelId:
      view === 'compare' && sub === 'panel' && panelId
        ? decodeURIComponent(panelId)
        : null,
  };
}

export function buildDeepLink(
  volume: string,
  chapter: string,
  pageIndex: number,
  view: ReaderView,
  panelId?: string | null,
): string {
  const base = `komayomi://reader/${encodeURIComponent(
    volume,
  )}/${encodeURIComponent(chapter)}/${pageIndex + 1}/${view}`;
  return panelId ? `${base}/panel/${encodeURIComponent(panelId)}` : base;
}
