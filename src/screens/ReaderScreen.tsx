import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { PageDoc, StoredProject } from '../types/project';
import { t } from '../i18n';
import { getPageDocs } from '../lib/db';
import { ComparePage, type CompareMode } from '../components/ComparePage';
import { OriginalPage } from '../components/OriginalPage';
import { ZoomPanView } from '../components/ZoomPanView';
import {
  Button,
  Chip,
  EmptyState,
  Header,
  ModeButton,
  Screen,
  Segmented,
} from '../components/ui';
import { colors, spacing } from '../theme';
import {
  langName,
  type PageEntry,
  type Panel,
  type ReadingDirection,
} from '../shared/types';
import { applyGroupOrder, sortReadingOrder } from '../shared/panelOrder';
import { stepPanelTarget } from '../lib/panelNavigation';
import type { ReaderView } from '../lib/deeplink';

type Scope = 'page' | 'panel';

export function ReaderScreen({
  project,
  volumeId,
  chapterId,
  initialPageIndex,
  view,
  readOnly,
  onModeChange,
  onViewChange,
  onBack,
  onOpenNote,
  onOpenPanel,
  onPageChange,
}: {
  project: StoredProject;
  volumeId: string;
  chapterId: string;
  initialPageIndex: number;
  view: ReaderView;
  readOnly: boolean;
  onModeChange: (mode: 'edit' | 'read') => void;
  onViewChange: (view: ReaderView) => void;
  onBack: () => void;
  onOpenNote: (pageIndex: number) => void;
  onOpenPanel: (pageIndex: number, panelId: string) => void;
  onPageChange: (pageIndex: number) => void;
}) {
  const volume = project.library.volumes.find(item => item.id === volumeId);
  const chapter = volume?.chapters.find(item => item.chapter === chapterId);
  const pages = useMemo(
    () => chapter?.pages.filter(page => !page.excluded) ?? [],
    [chapter],
  );

  const languages = useMemo(() => {
    const found = new Set<string>();
    for (const page of pages)
      for (const lang of Object.keys(page.files)) found.add(lang);
    const preferred = (
      project.library.langOrder ??
      project.library.languages ??
      []
    ).filter(lang => found.has(lang));
    for (const lang of found)
      if (!preferred.includes(lang)) preferred.push(lang);
    return preferred;
  }, [pages, project.library.langOrder, project.library.languages]);

  const initialPosition = useMemo(() => {
    const found = pages.findIndex(page => page.index === initialPageIndex);
    return found >= 0 ? found : 0;
  }, [pages, initialPageIndex]);

  const [mode, setMode] = useState<CompareMode>('split');
  const [scope, setScope] = useState<Scope>('page');
  const [panelIndex, setPanelIndex] = useState(0);
  const [maskEnabled, setMaskEnabled] = useState(false);
  const [masked, setMasked] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(initialPosition);
  const [zoomed, setZoomed] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [docs, setDocs] = useState<Record<string, PageDoc>>({});
  const listRef = useRef<FlatList<PageEntry>>(null);
  const currentRef = useRef(initialPosition);
  const programmaticScroll = useRef(false);

  currentRef.current = current;

  const currentPage = pages[Math.min(current, Math.max(pages.length - 1, 0))];

  const directionOf = (doc: PageDoc | undefined): ReadingDirection =>
    doc?.readingDirection ??
    project.config?.volumes?.[volumeId]?.defaultDirection ??
    'rtl';

  const panelsOf = (index: number): Panel[] => {
    const doc = docs[String(index)];
    return applyGroupOrder(
      sortReadingOrder(doc?.panels ?? [], directionOf(doc), panel => panel.rect),
      doc?.groups,
    );
  };

  const orderedPanels = currentPage ? panelsOf(currentPage.index) : [];
  const activePanel =
    orderedPanels.length > 0
      ? orderedPanels[Math.min(panelIndex, orderedPanels.length - 1)]
      : null;

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
      .then(map => {
        if (alive) setDocs(map);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [project.id, volumeId, chapterId]);

  useEffect(() => {
    setPanelIndex(index =>
      Math.min(index, Math.max(orderedPanels.length - 1, 0)),
    );
  }, [orderedPanels.length]);

  const toggleMask = (lang: string) => {
    setMasked(previous => ({ ...previous, [lang]: !previous[lang] }));
    if (!maskEnabled) setMaskEnabled(true);
  };

  const scrollToPage = (pageIndex: number) => {
    const position = pages.findIndex(page => page.index === pageIndex);
    if (position < 0) return;
    programmaticScroll.current = true;
    setCurrent(position);
    currentRef.current = position;
    onPageChange(pageIndex);
    listRef.current?.scrollToIndex({ index: position, animated: true });
  };

  const stepPanel = (delta: number) => {
    if (!currentPage || !orderedPanels.length) return;
    if (scope === 'page') {
      setScope('panel');
      setPanelIndex(delta > 0 ? 0 : orderedPanels.length - 1);
      setZoomed(false);
      return;
    }
    const target = stepPanelTarget(
      pages,
      panelsOf,
      currentPage.index,
      panelIndex,
      delta,
    );
    if (!target) return;
    setScope('panel');
    setPanelIndex(target.panelIndex);
    setZoomed(false);
    if (target.pageIndex !== currentPage.index) scrollToPage(target.pageIndex);
  };

  const panelTarget = (delta: number) =>
    currentPage && scope === 'panel' && orderedPanels.length
      ? stepPanelTarget(
          pages,
          panelsOf,
          currentPage.index,
          panelIndex,
          delta,
        )
      : currentPage && orderedPanels.length
        ? ({ pageIndex: currentPage.index, panelIndex: 0 } as const)
        : null;

  const canStep = (delta: number) => Boolean(panelTarget(delta));

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!area.width) return;
    if (programmaticScroll.current) {
      programmaticScroll.current = false;
      return;
    }
    const position = Math.round(event.nativeEvent.contentOffset.x / area.width);
    if (position !== currentRef.current) {
      const target = pages[position];
      currentRef.current = position;
      setCurrent(position);
      setPanelIndex(0);
      setZoomed(false);
      if (target) onPageChange(target.index);
    }
  };

  const openPanel = (pageIndex: number) => {
    if (!activePanel) return;
    onOpenPanel(pageIndex, activePanel.id);
  };

  const toggleChrome = () => setChromeVisible(visible => !visible);

  if (!chapter || !pages.length) {
    return (
      <Screen>
        <Header
          title={chapter?.title ?? chapterId}
          subtitle={volume?.title ?? volumeId}
          onBack={onBack}
        />
        <EmptyState title={t('reader.noImages')} />
      </Screen>
    );
  }

  const page = pages[Math.min(current, pages.length - 1)];
  const pageStyle = { width: area.width, height: area.height };
  const panelPosition = Math.min(panelIndex, Math.max(orderedPanels.length - 1, 0)) + 1;

  return (
    <Screen>
      {chromeVisible ? (
        <Header
          title={chapter?.title ?? chapterId}
          subtitle={t('reader.pageOf', {
            page: Math.min(current, pages.length - 1) + 1,
            total: pages.length,
          })}
          onBack={onBack}
          right={
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => onOpenNote(page.index)}
                hitSlop={8}
                style={styles.noteButton}
                accessibilityRole="button"
              >
                <Text style={styles.noteButtonText}>{t('reader.notes')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setSettingsVisible(true)}
                hitSlop={8}
                style={styles.settingsButton}
                accessibilityRole="button"
                accessibilityLabel={t('reader.settings')}
              >
                <Text style={styles.settingsButtonText}>⋯</Text>
              </Pressable>
            </View>
          }
        />
      ) : null}

      <View
        style={styles.pagerWrap}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (
            Math.abs(width - area.width) > 1 ||
            Math.abs(height - area.height) > 1
          )
            setArea({ width, height });
        }}
      >
        {area.width > 0 && area.height > 0 ? (
          <FlatList
            ref={listRef}
            key={`${chapterId}-${Math.round(area.width)}`}
            data={pages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => String(item.index)}
            initialScrollIndex={initialPosition}
            getItemLayout={(_, index) => ({
              length: area.width,
              offset: area.width * index,
              index,
            })}
            onMomentumScrollEnd={handleScrollEnd}
            windowSize={3}
            renderItem={({ item }) =>
              view === 'original' ? (
                <View style={pageStyle}>
                  <OriginalPage
                    page={item}
                    languages={languages}
                    maskEnabled={maskEnabled}
                    masked={masked}
                    width={area.width}
                    height={area.height}
                    onToggleMask={toggleMask}
                    onSingleTap={toggleChrome}
                    missingLabel={t('reader.missing')}
                  />
                </View>
              ) : (
                <View style={pageStyle}>
                  <ZoomPanView
                    resetKey={`${chapterId}/${item.index}/${mode}/${scope}/${panelIndex}`}
                    panEnabled={zoomed}
                    onSingleTap={toggleChrome}
                    onZoomChange={setZoomed}
                    onDoubleTap={
                      scope === 'panel' &&
                      activePanel &&
                      item.index === currentPage?.index
                        ? () => openPanel(item.index)
                        : undefined
                    }
                  >
                    <ComparePage
                      page={item}
                      languages={languages}
                      mode={mode}
                      maskEnabled={maskEnabled}
                      masked={masked}
                      offsets={docs[String(item.index)]?.offsets ?? {}}
                      panel={
                        item.index === currentPage?.index
                          ? scope === 'panel'
                            ? activePanel?.rect ?? null
                            : null
                          : null
                      }
                      width={area.width}
                      height={area.height}
                      onToggleMask={toggleMask}
                      missingLabel={t('reader.missing')}
                    />
                  </ZoomPanView>
                </View>
              )
            }
          />
        ) : null}
      </View>

      {chromeVisible && view === 'compare' ? (
        <View style={styles.panelBar}>
          <Pressable
            onPress={() => stepPanel(-1)}
            disabled={!canStep(-1)}
            hitSlop={8}
            accessibilityRole="button"
            style={[
              styles.panelButton,
              !canStep(-1) && styles.panelButtonDisabled,
            ]}
          >
            <Text style={styles.panelButtonText}>
              {t('reader.prevPanel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!currentPage || !orderedPanels.length) return;
              if (scope === 'page') {
                setScope('panel');
                setPanelIndex(0);
              } else {
                openPanel(currentPage.index);
              }
            }}
            disabled={!orderedPanels.length}
            accessibilityRole="button"
            accessibilityLabel={t('reader.openPanel')}
            style={styles.panelCountButton}
          >
            <Text style={styles.panelCount}>
              {orderedPanels.length
                ? t('reader.panelOf', {
                    panel: panelPosition,
                    total: orderedPanels.length,
                  })
                : t('reader.noPanels')}
            </Text>
            {scope === 'panel' && orderedPanels.length ? (
              <Text style={styles.panelOpen}>{t('reader.openPanel')}</Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => stepPanel(1)}
            disabled={!canStep(1)}
            hitSlop={8}
            accessibilityRole="button"
            style={[
              styles.panelButton,
              !canStep(1) && styles.panelButtonDisabled,
            ]}
          >
            <Text style={styles.panelButtonText}>
              {t('reader.nextPanel')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSettingsVisible(false)}
            accessibilityLabel={t('common.close')}
          />
          <View style={styles.settingsSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('reader.settings')}</Text>
              <Pressable
                onPress={() => setSettingsVisible(false)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.sheetClose}>{t('common.close')}</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>{t('reader.view')}</Text>
                <Segmented
                  value={view}
                  onChange={onViewChange}
                  options={[
                    { value: 'compare', label: t('reader.viewCompare') },
                    { value: 'original', label: t('reader.viewOriginal') },
                  ]}
                />
              </View>

              {view === 'compare' ? (
                <>
                  <View style={styles.settingSection}>
                    <Text style={styles.settingLabel}>
                      {t('reader.compareLayout')}
                    </Text>
                    <Segmented
                      value={mode}
                      onChange={setMode}
                      options={[
                        { value: 'split', label: t('reader.modeSplit') },
                        { value: 'overlay', label: t('reader.modeOverlay') },
                      ]}
                    />
                  </View>
                  <View style={styles.settingSection}>
                    <Text style={styles.settingLabel}>
                      {t('reader.navigationUnit')}
                    </Text>
                    <Segmented
                      value={scope}
                      onChange={next => {
                        setScope(next);
                        setPanelIndex(0);
                      }}
                      options={[
                        { value: 'page', label: t('reader.scopePage') },
                        { value: 'panel', label: t('reader.scopePanel') },
                      ]}
                    />
                  </View>
                </>
              ) : null}

              <View style={styles.settingInline}>
                <Text style={styles.settingLabel}>{t('reader.mask')}</Text>
                <Switch
                  value={maskEnabled}
                  onValueChange={setMaskEnabled}
                  trackColor={{ false: colors.border, true: colors.accentSoft }}
                  thumbColor={maskEnabled ? colors.accent : colors.textMuted}
                />
              </View>

              <View style={styles.settingSection}>
                <Text style={styles.settingLabel}>
                  {t('reader.languages')}
                </Text>
                <View style={styles.langs}>
                  {languages.map(lang => (
                    <Chip
                      key={lang}
                      label={langName(lang)}
                      active={maskEnabled ? !masked[lang] : true}
                      onPress={() => toggleMask(lang)}
                      dotColor={
                        masked[lang] && maskEnabled
                          ? colors.warning
                          : colors.success
                      }
                    />
                  ))}
                </View>
              </View>

              <View style={styles.settingInline}>
                <Text style={styles.settingLabel}>{t('reader.editMode')}</Text>
                <ModeButton
                  readOnly={readOnly}
                  onToggle={() => onModeChange(readOnly ? 'edit' : 'read')}
                />
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Text style={styles.gestureHint}>{t('reader.chromeHint')}</Text>
              <Text style={styles.gestureHint}>
                {view === 'original'
                  ? t('reader.originalHint')
                  : scope === 'panel'
                    ? t('reader.panelHint')
                    : t('reader.zoomHint')}
              </Text>
              <Button
                label={t('reader.hideControls')}
                onPress={() => {
                  setSettingsVisible(false);
                  setChromeVisible(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  noteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  noteButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  settingsButton: {
    width: 38,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  settingsButtonText: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 24,
    marginTop: -7,
  },
  pagerWrap: { flex: 1 },
  panelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  panelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  panelButtonDisabled: { opacity: 0.4 },
  panelButtonText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  panelCountButton: { flex: 1, alignItems: 'center', gap: 1 },
  panelCount: { color: colors.text, fontSize: 12, fontWeight: '600' },
  panelOpen: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  settingsSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sheetClose: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { padding: spacing.lg, gap: spacing.md },
  settingSection: { gap: spacing.xs },
  settingInline: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  settingLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  langs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sheetFooter: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gestureHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
});
