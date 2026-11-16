import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { PageDoc, StoredProject } from '../types/project';
import type { Panel, ReadingDirection } from '../shared/types';
import { langShort } from '../shared/types';
import { sortReadingOrder } from '../shared/panelOrder';
import { t } from '../i18n';
import { getPageDocs } from '../lib/db';
import { fileUri } from '../lib/files';
import { stepPanelTarget } from '../lib/panelNavigation';
import { PanelImage } from '../components/PanelImage';
import { EmptyState, Header, Screen } from '../components/ui';
import { colors, radius, spacing } from '../theme';

/**
 * Enlarged view of one panel: the same crop for every language, stacked in the
 * configured language order. Panel stepping continues onto neighbouring pages,
 * and the page buttons jump a whole page while keeping the detail view open.
 */
export function PanelDetailScreen({
  project,
  volumeId,
  chapterId,
  pageIndex,
  panelId,
  onBack,
  onNavigate,
}: {
  project: StoredProject;
  volumeId: string;
  chapterId: string;
  pageIndex: number;
  panelId: string | null;
  onBack: () => void;
  onNavigate: (pageIndex: number, panelId: string | null) => void;
}) {
  const volume = project.library.volumes.find(item => item.id === volumeId);
  const chapter = volume?.chapters.find(item => item.chapter === chapterId);
  const pages = useMemo(
    () => chapter?.pages.filter(page => !page.excluded) ?? [],
    [chapter],
  );
  const { height: windowHeight } = useWindowDimensions();
  const [docs, setDocs] = useState<Record<string, PageDoc>>({});

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

  const directionOf = useCallback(
    (doc: PageDoc | undefined): ReadingDirection =>
      doc?.readingDirection ??
      project.config?.volumes?.[volumeId]?.defaultDirection ??
      'rtl',
    [project.config, volumeId],
  );

  const panelsOf = useCallback(
    (index: number): Panel[] => {
      const doc = docs[String(index)];
      return sortReadingOrder(doc?.panels ?? [], directionOf(doc), p => p.rect);
    },
    [docs, directionOf],
  );

  const currentPage =
    pages.find(page => page.index === pageIndex) ?? pages[0] ?? null;
  const ordered = currentPage ? panelsOf(currentPage.index) : [];
  const activePanel =
    ordered.find(panel => panel.id === panelId) ?? ordered[0] ?? null;
  const activeIndex = activePanel
    ? ordered.findIndex(panel => panel.id === activePanel.id)
    : -1;
  const previousTarget = currentPage
    ? stepPanelTarget(pages, panelsOf, currentPage.index, activeIndex, -1)
    : null;
  const nextTarget = currentPage
    ? stepPanelTarget(pages, panelsOf, currentPage.index, activeIndex, 1)
    : null;

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

  const goPanel = (delta: number) => {
    if (!currentPage) return;
    const target = stepPanelTarget(
      pages,
      panelsOf,
      currentPage.index,
      activeIndex,
      delta,
    );
    if (!target) return;
    const targetPanels = panelsOf(target.pageIndex);
    onNavigate(target.pageIndex, targetPanels[target.panelIndex]?.id ?? null);
  };

  const goPage = (delta: number) => {
    if (!currentPage) return;
    const position = pages.findIndex(page => page.index === currentPage.index);
    const next = pages[position + delta];
    if (!next) return;
    onNavigate(next.index, panelsOf(next.index)[0]?.id ?? null);
  };

  if (!chapter || !pages.length || !currentPage) {
    return (
      <Screen>
        <Header
          title={t('detail.title')}
          subtitle={chapter?.title ?? chapterId}
          onBack={onBack}
        />
        <EmptyState title={t('reader.noImages')} />
      </Screen>
    );
  }

  const pagePosition =
    pages.findIndex(item => item.index === currentPage.index) + 1;
  const pageEntry = pages.find(item => item.index === currentPage.index)!;
  const paneHeight = Math.max(220, Math.round(windowHeight * 0.4));

  return (
    <Screen>
      <Header
        title={t('detail.title')}
        subtitle={t('reader.pageOf', {
          page: pagePosition,
          total: pages.length,
        })}
        onBack={onBack}
      />

      {activePanel ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.positionRow}>
            <Text style={styles.position}>
              {t('detail.panelOf', {
                panel: activeIndex + 1,
                total: ordered.length,
              })}
            </Text>
          </View>
          {languages.map(lang => {
            const file = pageEntry.files[lang];
            return (
              <View key={lang} style={styles.pane}>
                <View style={[styles.imageBox, { height: paneHeight }]}>
                  {file ? (
                    <PanelImage
                      uri={fileUri(file)}
                      rect={activePanel.rect}
                      style={styles.image}
                    />
                  ) : (
                    <View style={styles.missing}>
                      <Text style={styles.missingText}>
                        {t('reader.missing')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.langBadge}>
                    <Text style={styles.langBadgeText}>{langShort(lang)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <EmptyState title={t('detail.noPanels')} />
      )}

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => goPage(-1)}
            disabled={pagePosition <= 1}
            style={[styles.navButton, pagePosition <= 1 && styles.navDisabled]}
            accessibilityRole="button"
          >
            <Text style={styles.navText}>
              « {t('detail.prevPage')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => goPage(1)}
            disabled={pagePosition >= pages.length}
            style={[
              styles.navButton,
              pagePosition >= pages.length && styles.navDisabled,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.navText}>{t('detail.nextPage')} »</Text>
          </Pressable>
        </View>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => goPanel(-1)}
            disabled={!activePanel || !previousTarget}
            style={[
              styles.navButton,
              (!activePanel || !previousTarget) && styles.navDisabled,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.navText}>‹ {t('detail.prev')}</Text>
          </Pressable>
          <Pressable
            onPress={() => goPanel(1)}
            disabled={!activePanel || !nextTarget}
            style={[
              styles.navButton,
              (!activePanel || !nextTarget) && styles.navDisabled,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.navText}>{t('detail.next')} ›</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  positionRow: { alignItems: 'center' },
  position: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  pane: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  imageBox: { width: '100%', backgroundColor: '#05070a' },
  image: { flex: 1 },
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
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  navDisabled: { opacity: 0.4 },
  navText: { color: colors.text, fontSize: 12, fontWeight: '600' },
});
