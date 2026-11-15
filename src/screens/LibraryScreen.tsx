import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChapterEntry, StoredProject } from '../types/project';
import { t } from '../i18n';
import { langShort } from '../shared/types';
import { Badge, Banner, Chip, Header, Screen } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export function LibraryScreen({
  project,
  onBack,
  onOpenChapter,
}: {
  project: StoredProject;
  onBack: () => void;
  onOpenChapter: (volumeId: string, chapterId: string) => void;
}) {
  return (
    <Screen>
      <Header
        title={project.name}
        subtitle={project.storageMode === 'packaged' ? t('home.packaged') : t('home.reference')}
        onBack={onBack}
        right={
          <Badge
            label={t('home.volumes', { count: project.library.volumes.length })}
            tone={project.storageMode === 'packaged' ? 'accent' : 'muted'}
          />
        }
      />
      {project.warnings.length ? <Banner text={project.warnings.join('\n')} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        {project.library.volumes.map((volume) => (
          <View key={volume.id} style={styles.volume}>
            <Text style={styles.volumeTitle}>{volume.title}</Text>
            <View style={styles.chips}>
              {volume.languages.map((lang) => (
                <Chip key={lang} label={langShort(lang)} active={false} />
              ))}
            </View>
            {volume.chapters.length === 0 ? (
              <Text style={styles.muted}>{t('library.noChapters')}</Text>
            ) : (
              volume.chapters.map((chapter) => (
                <ChapterRow key={chapter.id} chapter={chapter} onPress={() => onOpenChapter(volume.id, chapter.chapter)} />
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function ChapterRow({ chapter, onPress }: { chapter: ChapterEntry; onPress: () => void }) {
  const pages = chapter.pages.filter((page) => !page.excluded).length;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chapter, pressed && styles.pressed]}>
      <View style={styles.chapterText}>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {chapter.title ?? chapter.chapter}
        </Text>
        <Text style={styles.chapterMeta}>{t('library.pages', { count: pages })}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  volume: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  volumeTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  chapterText: { flex: 1, gap: 2 },
  chapterTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chapterMeta: { color: colors.textMuted, fontSize: 12 },
  chevron: { color: colors.textMuted, fontSize: 22 },
  muted: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
});
