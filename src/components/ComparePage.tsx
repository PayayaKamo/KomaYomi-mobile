import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlignOffset, Lang, PageEntry } from '../shared/types';
import { DEFAULT_OFFSET } from '../shared/types';
import { fileUri } from '../lib/files';
import { langName, langShort } from '../shared/types';
import { colors, radius, spacing } from '../theme';

export type CompareMode = 'split' | 'overlay';

type Props = {
  page: PageEntry;
  languages: Lang[];
  mode: CompareMode;
  maskEnabled: boolean;
  masked: Record<string, boolean>;
  offsets: Partial<Record<Lang, AlignOffset>>;
  width: number;
  height: number;
  onToggleMask: (lang: Lang) => void;
  missingLabel: string;
};

export function ComparePage({
  page,
  languages,
  mode,
  maskEnabled,
  masked,
  offsets,
  width,
  height,
  onToggleMask,
  missingLabel,
}: Props) {
  return (
    <View style={{ width, height }}>
      <View style={styles.canvas}>
        {mode === 'split' ? (
          <View style={styles.row}>
            {languages.map((lang) => {
              const file = page.files[lang];
              const isMasked = maskEnabled && Boolean(masked[lang]);
              return (
                <View key={lang} style={styles.column}>
                  {file ? (
                    <Image
                      source={{ uri: fileUri(file) }}
                      style={styles.image}
                      resizeMode="contain"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.missing}>
                      <Text style={styles.missingText}>{missingLabel}</Text>
                    </View>
                  )}
                  <View style={styles.columnLabel}>
                    <Text style={styles.columnLabelText}>{langShort(lang)}</Text>
                  </View>
                  {isMasked ? (
                    <Pressable style={styles.mask} onPress={() => onToggleMask(lang)}>
                      <Text style={styles.maskTitle}>{langName(lang)}</Text>
                      <Text style={styles.maskHint}>{langShort(lang)}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Overlay
            page={page}
            languages={languages}
            maskEnabled={maskEnabled}
            masked={masked}
            offsets={offsets}
            width={width}
            height={height}
            missingLabel={missingLabel}
          />
        )}
      </View>
    </View>
  );
}

function Overlay({
  page,
  languages,
  maskEnabled,
  masked,
  offsets,
  width,
  height,
  missingLabel,
}: Omit<Props, 'mode' | 'onToggleMask'>) {
  const visible = languages.filter((lang) => Boolean(page.files[lang]) && !(maskEnabled && masked[lang]));
  if (!visible.length) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{missingLabel}</Text>
      </View>
    );
  }
  return (
    <>
      {visible.map((lang, index) => {
        const file = page.files[lang]!;
        const offset = offsets[lang] ?? DEFAULT_OFFSET;
        return (
          <View
            key={lang}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: index === 0 ? 1 : visible.length > 1 ? 0.5 : 1,
                transform: [
                  { translateX: offset.x * width },
                  { translateY: offset.y * height },
                  { scale: offset.scale || 1 },
                ],
              },
            ]}>
            <Image source={{ uri: fileUri(file) }} style={styles.image} resizeMode="contain" fadeDuration={0} />
          </View>
        );
      })}
      <View style={styles.overlayBadges}>
        {visible.map((lang) => (
          <View key={lang} style={styles.overlayBadge}>
            <Text style={styles.overlayBadgeText}>{langShort(lang)}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#05070a' },
  row: { flex: 1, flexDirection: 'row' },
  column: { flex: 1, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  image: { flex: 1, width: '100%' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  missingText: { color: colors.textMuted, fontSize: 12 },
  columnLabel: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(8, 11, 16, 0.72)',
  },
  columnLabelText: { color: colors.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
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
  maskHint: { color: colors.border, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  overlayBadges: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  overlayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(8, 11, 16, 0.72)',
  },
  overlayBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
});
