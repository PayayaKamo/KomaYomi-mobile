import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { PageDoc, StoredProject } from '../types/project';
import { t } from '../i18n';
import { getPageDocs } from '../lib/db';
import { ComparePage, type CompareMode } from '../components/ComparePage';
import { ZoomPanView } from '../components/ZoomPanView';
import { Chip, EmptyState, Header, Screen, Segmented } from '../components/ui';
import { colors, spacing } from '../theme';
import { langName } from '../shared/types';

export function ReaderScreen({
  project,
  volumeId,
  chapterId,
  initialPageIndex,
  onBack,
  onOpenNote,
  onPageChange,
}: {
  project: StoredProject;
  volumeId: string;
  chapterId: string;
  initialPageIndex: number;
  onBack: () => void;
  onOpenNote: (pageIndex: number) => void;
  onPageChange: (pageIndex: number) => void;
}) {
  const volume = project.library.volumes.find((item) => item.id === volumeId);
  const chapter = volume?.chapters.find((item) => item.chapter === chapterId);
  const pages = useMemo(() => chapter?.pages.filter((page) => !page.excluded) ?? [], [chapter]);

  const languages = useMemo(() => {
    const found = new Set<string>();
    for (const page of pages) for (const lang of Object.keys(page.files)) found.add(lang);
    const preferred = (project.library.langOrder ?? project.library.languages ?? []).filter((lang) => found.has(lang));
    for (const lang of found) if (!preferred.includes(lang)) preferred.push(lang);
    return preferred;
  }, [pages, project.library.langOrder, project.library.languages]);

  const [mode, setMode] = useState<CompareMode>('split');
  const [maskEnabled, setMaskEnabled] = useState(false);
  const [masked, setMasked] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(
    Math.min(Math.max(initialPageIndex, 0), Math.max(pages.length - 1, 0)),
  );
  const [zoomed, setZoomed] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [docs, setDocs] = useState<Record<string, PageDoc>>({});

  const languageKey = languages.join('|');

  useEffect(() => {
    setMasked(() => {
      const next: Record<string, boolean> = {};
      languages.forEach((lang, index) => {
        next[lang] = index > 0;
      });
      return next;
    });
    // Reset masks only when the chapter's language set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageKey]);

  useEffect(() => {
    let alive = true;
    getPageDocs(project.id, volumeId, chapterId)
      .then((map) => {
        if (alive) setDocs(map);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [project.id, volumeId, chapterId]);

  const toggleMask = (lang: string) => {
    setMasked((previous) => ({ ...previous, [lang]: !previous[lang] }));
    if (!maskEnabled) setMaskEnabled(true);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!area.width) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / area.width);
    if (index !== current) {
      setCurrent(index);
      setZoomed(false);
      onPageChange(index);
    }
  };

  if (!chapter || !pages.length) {
    return (
      <Screen>
        <Header title={chapter?.title ?? chapterId} subtitle={volume?.title ?? volumeId} onBack={onBack} />
        <EmptyState title={t('reader.noImages')} />
      </Screen>
    );
  }

  const page = pages[Math.min(current, pages.length - 1)];

  return (
    <Screen>
      <Header
        title={chapter?.title ?? chapterId}
        subtitle={t('reader.pageOf', { page: Math.min(current, pages.length - 1) + 1, total: pages.length })}
        onBack={onBack}
        right={
          <Pressable onPress={() => onOpenNote(page.index)} hitSlop={8} style={styles.noteButton}>
            <Text style={styles.noteButtonText}>{t('reader.notes')}</Text>
          </Pressable>
        }
      />

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <View style={styles.segmented}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'split', label: t('reader.modeSplit') },
                { value: 'overlay', label: t('reader.modeOverlay') },
              ]}
            />
          </View>
          <View style={styles.maskSwitch}>
            <Text style={styles.maskLabel}>{t('reader.mask')}</Text>
            <Switch
              value={maskEnabled}
              onValueChange={setMaskEnabled}
              trackColor={{ false: colors.border, true: colors.accentSoft }}
              thumbColor={maskEnabled ? colors.accent : colors.textMuted}
            />
          </View>
        </View>
        <View style={styles.langs}>
          {languages.map((lang) => (
            <Chip
              key={lang}
              label={`${langName(lang)}`}
              active={maskEnabled ? !masked[lang] : true}
              onPress={() => toggleMask(lang)}
              dotColor={masked[lang] && maskEnabled ? colors.warning : colors.success}
            />
          ))}
        </View>
      </View>

      <View
        style={styles.pagerWrap}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (Math.abs(width - area.width) > 1 || Math.abs(height - area.height) > 1) setArea({ width, height });
        }}>
        {area.width > 0 && area.height > 0 ? (
          <FlatList
            key={`${chapterId}-${Math.round(area.width)}x${Math.round(area.height)}`}
            data={pages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.index)}
            initialScrollIndex={Math.min(Math.max(initialPageIndex, 0), pages.length - 1)}
            getItemLayout={(_, index) => ({ length: area.width, offset: area.width * index, index })}
            onMomentumScrollEnd={handleScrollEnd}
            windowSize={3}
            renderItem={({ item }) => (
              <ZoomPanView
                resetKey={`${chapterId}/${item.index}/${mode}`}
                panEnabled={zoomed}
                onZoomChange={setZoomed}>
                <ComparePage
                  page={item}
                  languages={languages}
                  mode={mode}
                  maskEnabled={maskEnabled}
                  masked={masked}
                  offsets={docs[String(item.index)]?.offsets ?? {}}
                  width={area.width}
                  height={area.height}
                  onToggleMask={toggleMask}
                  missingLabel={t('reader.missing')}
                />
              </ZoomPanView>
            )}
          />
        ) : null}
      </View>

      <Text style={styles.hint}>{t('reader.zoomHint')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  segmented: { flex: 1 },
  maskSwitch: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  maskLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pagerWrap: { flex: 1, marginTop: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: spacing.sm },
  noteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  noteButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});
