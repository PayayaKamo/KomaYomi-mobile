import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StoredProject } from '../types/project';
import { formatDate, t } from '../i18n';
import { removeDirectory } from '../lib/files';
import { importPickedProject, type ImportPhase } from '../lib/projectImport';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ModeButton,
  Screen,
} from '../components/ui';
import { colors, radius, spacing } from '../theme';
import { deleteProjectRecord } from '../lib/db';

export function pageCount(project: StoredProject): number {
  return project.library.volumes.reduce(
    (sum, volume) => sum + volume.chapters.reduce((inner, chapter) => inner + chapter.pages.length, 0),
    0,
  );
}

const phaseLabel = (phase: ImportPhase): string => {
  switch (phase) {
    case 'reading':
      return t('home.importing');
    case 'extracting':
      return t('home.importing');
    case 'images':
      return t('home.importing');
    default:
      return t('home.importing');
  }
};

export function HomeScreen({
  projects,
  readOnly,
  onModeChange,
  onOpen,
  onImported,
  onDelete,
}: {
  projects: StoredProject[];
  readOnly: boolean;
  onModeChange: (mode: 'edit' | 'read') => void;
  onOpen: (project: StoredProject) => void;
  onImported: (project: StoredProject) => void;
  onDelete: (project: StoredProject) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = async () => {
    if (busy || readOnly) return;
    setError(null);
    setBusy(t('home.importing'));
    try {
      const result = await importPickedProject((phase) => setBusy(phaseLabel(phase)));
      if (result) onImported(result.project);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = (project: StoredProject) => {
    Alert.alert(t('home.deleteTitle'), t('home.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteProjectRecord(project.id)
            .then(() => removeDirectory(project.directory))
            .then(() => onDelete(project))
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.brand}>{t('app.name')}</Text>
            <ModeButton
              readOnly={readOnly}
              onToggle={() => onModeChange(readOnly ? 'edit' : 'read')}
            />
          </View>
          <Text style={styles.tagline}>{t('app.tagline')}</Text>
        </View>

        {readOnly ? <Banner text={t('mode.readOnlyHint')} /> : null}
        {error ? <Banner text={error} tone="error" /> : null}

        <View style={styles.actions}>
          <Button
            label={t('home.openProject')}
            onPress={() => runImport()}
            busy={Boolean(busy)}
            disabled={readOnly}
          />
          {/* The bundled sample is being replaced; keep the slot until the new file ships. */}
          {Platform.OS === 'android' ? (
            <Button label={t('home.sampleSoon')} variant="secondary" onPress={() => undefined} disabled />
          ) : null}
        </View>

        {busy ? <Text style={styles.busy}>{busy}</Text> : null}

        <Text style={styles.sectionTitle}>{t('home.title')}</Text>
        {projects.length === 0 ? (
          <EmptyState title={t('home.empty')} hint={t('home.emptyHint')} />
        ) : (
          projects.map((project) => (
            <Pressable
              key={project.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => onOpen(project)}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {project.name}
                </Text>
                <Badge
                  label={project.storageMode === 'packaged' ? t('home.packaged') : t('home.reference')}
                  tone={project.storageMode === 'packaged' ? 'accent' : 'muted'}
                />
              </View>
              <Text style={styles.cardMeta}>
                {t('home.volumes', { count: project.library.volumes.length })} ·{' '}
                {t('home.pages', { count: pageCount(project) })} · {formatDate(project.importedAt)}
              </Text>
              {project.warnings.length ? (
                <Text style={styles.cardWarning}>{project.warnings[project.warnings.length - 1]}</Text>
              ) : null}
              <View style={styles.cardActions}>
                <Text style={styles.openHint}>{t('library.chapters')} ›</Text>
                {readOnly ? null : (
                  <Pressable onPress={() => confirmDelete(project)} hitSlop={8}>
                    <Text style={styles.delete}>{t('common.delete')}</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  hero: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brand: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: colors.textMuted, fontSize: 14 },
  actions: { gap: spacing.sm },
  busy: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  sectionTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
  cardWarning: { color: colors.warning, fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  openHint: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  delete: { color: colors.danger, fontSize: 12 },
});
