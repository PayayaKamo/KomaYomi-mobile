import en, { type MessageKey } from './en';
import zh from './zh';
import ja from './ja';

export type Locale = 'en' | 'zh' | 'ja';

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, zh, ja };

/**
 * The app follows the system language and falls back to English.
 * Hermes ships a full Intl implementation, so `Intl` is the least fragile
 * way to read the device locale on both iOS and Android.
 */
export function detectLocale(): Locale {
  let tag = 'en';
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    // Keep the English fallback when Intl is unavailable.
  }
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) return 'zh';
  if (lower.startsWith('ja')) return 'ja';
  return 'en';
}

let current: Locale = 'en';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = catalogs[current][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

/** Locale-aware short date used on the project cards. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleDateString(current === 'zh' ? 'zh-CN' : current === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
