import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PageEntry, StoredProject } from '../types/project';
import { t } from '../i18n';
import { fileUri } from '../lib/files';
import { getAnnotatedPages } from '../lib/db';
import { Badge, Header, Screen } from '../components/ui';
import { colors, radius, spacing } from '../theme';

const COLUMNS = 3;
const GAP = spacing.sm;

export function PagesScreen({
  project,
  volumeId,
  chapterId,
  onBack,
  onOpenPage,
}: {
  project: StoredProject;
  volumeId: string;
  chapterId: string;
  onBack: () => void;
  onOpenPage: (pageIndex: number) => void;
}) {
  const volume = project.library.volumes.find((item) => item.id === volumeId);
  const chapter = volume?.chapters.find((item) => item.chapter === chapterId);
  const [annotated, setAnnotated] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    getAnnotatedPages(project.id)
      .then((set) => {
        if (alive) setAnnotated(set);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [project.id]);

  const pages = useMemo(() => chapter?.pages.filter((page) => !page.excluded) ?? [], [chapter]);
  const width = (Dimensions.get('window').width - spacing.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <Screen>
      <Header
        title={chapter?.title ?? chapterId}
        subtitle={volume?.title ?? volumeId}
        onBack={onBack}
        right={<Badge label={t('library.pages', { count: pages.length })} />}
      />
      <FlatList
        data={pages}
        keyExtractor={(page) => String(page.index)}
        numColumns={COLUMNS}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={<Text style={styles.empty}>{t('pages.empty')}</Text>}
        renderItem={({ item }) => (
          <PageThumb
            page={item}
            width={width}
            annotated={annotated.has(`${volumeId}/${chapterId}/${item.index}`)}
            onPress={() => onOpenPage(item.index)}
          />
        )}
      />
    </Screen>
  );
}

function PageThumb({
  page,
  width,
  annotated,
  onPress,
}: {
  page: PageEntry;
  width: number;
  annotated: boolean;
  onPress: () => void;
}) {
  const file = Object.values(page.files)[0];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View style={[styles.thumbFrame, { width, height: width * 1.4 }]}>
        {file ? (
          <Image source={{ uri: fileUri(file) }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <Text style={styles.thumbMissing}>—</Text>
        )}
        {annotated ? <View style={styles.noteDot} /> : null}
      </View>
      <Text style={styles.thumbLabel}>{t('pages.page', { number: page.index + 1 })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: GAP },
  row: { gap: GAP },
  pressed: { opacity: 0.7 },
  thumbFrame: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { width: '100%', height: '100%' },
  thumbMissing: { color: colors.textMuted, fontSize: 20 },
  thumbLabel: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs, textAlign: 'center' },
  noteDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xxl },
});
