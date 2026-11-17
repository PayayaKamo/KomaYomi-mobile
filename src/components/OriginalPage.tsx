import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lang, PageEntry } from '../shared/types';
import { langName, langShort } from '../shared/types';
import { fileUri } from '../lib/files';
import { t } from '../i18n';
import { ZoomPanView } from './ZoomPanView';
import { colors, radius, spacing } from '../theme';

type Props = {
  page: PageEntry;
  languages: Lang[];
  maskEnabled: boolean;
  masked: Record<string, boolean>;
  width: number;
  height: number;
  onToggleMask: (lang: Lang) => void;
  onSingleTap: () => void;
  missingLabel: string;
};

/**
 * Original reading view: the whole page, uncropped, one pane per language.
 *
 * Phones show one lane at a time and tablets rotate two lanes; the language tabs
 * pick the first lane, and the remaining languages stay reachable without
 * leaving the page. Pinching zooms a pane, and panning only takes over once it
 * is zoomed so horizontal swipes still turn pages.
 */
export function OriginalPage({
  page,
  languages,
  maskEnabled,
  masked,
  width,
  height,
  onToggleMask,
  onSingleTap,
  missingLabel,
}: Props) {
  const columns = width >= 700 ? 2 : 1;
  const [focusLang, setFocusLang] = useState<Lang>(languages[0] ?? 'ja');
  const [zoomed, setZoomed] = useState<Record<string, boolean>>({});
  const [scales, setScales] = useState<Record<string, number>>({});
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    if (!languages.includes(focusLang)) setFocusLang(languages[0] ?? 'ja');
  }, [languages, focusLang]);

  // Turning the page starts with the full page in view again.
  useEffect(() => {
    setZoomed({});
    setScales({});
    setResetNonce(value => value + 1);
  }, [page.index]);

  const paneLangs = useMemo(() => {
    if (!languages.length || languages.length <= columns) return languages;
    const start = Math.max(0, languages.indexOf(focusLang));
    return [...languages.slice(start), ...languages.slice(0, start)].slice(
      0,
      columns,
    );
  }, [languages, columns, focusLang]);

  return (
    <View style={{ width, height }}>
      {languages.length > columns ? (
        <View style={styles.tabs}>
          {languages.map(lang => {
            const active = paneLangs.includes(lang);
            return (
              <Pressable
                key={lang}
                onPress={() => setFocusLang(lang)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {langShort(lang)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.grid}>
        {paneLangs.map(lang => {
          const file = page.files[lang];
          const isMasked = maskEnabled && Boolean(masked[lang]);
          const scale = scales[lang] ?? 1;
          return (
            <View key={lang} style={styles.pane}>
              {file ? (
                <ZoomPanView
                  resetKey={`${page.index}/${lang}/${resetNonce}`}
                  panEnabled={Boolean(zoomed[lang])}
                  onSingleTap={onSingleTap}
                  onZoomChange={value =>
                    setZoomed(previous =>
                      previous[lang] === value
                        ? previous
                        : { ...previous, [lang]: value },
                    )
                  }
                  onScaleChange={value =>
                    setScales(previous =>
                      previous[lang] === value
                        ? previous
                        : { ...previous, [lang]: value },
                    )
                  }
                >
                  <Image
                    source={{ uri: fileUri(file) }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                    fadeDuration={0}
                  />
                </ZoomPanView>
              ) : (
                <View style={styles.missing}>
                  <Text style={styles.missingText}>{missingLabel}</Text>
                </View>
              )}

              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{langShort(lang)}</Text>
              </View>

              {file ? (
                <View style={styles.zoomBadge}>
                  <Text style={styles.zoomText}>×{scale.toFixed(2)}</Text>
                  <Pressable
                    onPress={() => setResetNonce(value => value + 1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('reader.resetZoom')}
                  >
                    <Text style={styles.zoomReset}>⟲</Text>
                  </Pressable>
                </View>
              ) : null}

              {isMasked ? (
                <Pressable
                  style={styles.mask}
                  onPress={() => onToggleMask(lang)}
                  accessibilityRole="button"
                  accessibilityLabel={langName(lang)}
                >
                  <Text style={styles.maskTitle}>{langName(lang)}</Text>
                  <Text style={styles.maskHint}>{t('reader.tapToToggle')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  tabLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: colors.text },
  grid: { flex: 1, flexDirection: 'row' },
  pane: {
    flex: 1,
    overflow: 'hidden',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.textMuted, fontSize: 12 },
  langBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(8, 11, 16, 0.72)',
  },
  langBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  zoomBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(8, 11, 16, 0.72)',
  },
  zoomText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  zoomReset: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  mask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.mask,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  maskTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  maskHint: { color: colors.textMuted, fontSize: 11 },
});
