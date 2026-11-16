import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StoredProject } from '../types/project';
import { formatDate, t } from '../i18n';
import { removeDirectory } from '../lib/files';
import { importPickedProject, type ImportPhase } from '../lib/projectImport';
import {
  SampleCancelledError,
  SAMPLE_APPROX_BYTES,
  findSampleProject,
  importSampleProject,
  isSampleProject,
  type SampleImport,
  type SampleProgress,
} from '../lib/sampleProject';
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

const formatSize = (bytes: number): string =>
  bytes > 0 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '0 MB';

type SampleState =
  | { status: 'idle' }
  | { status: 'downloading'; received: number; total: number }
  | { status: 'importing' }
  | { status: 'error'; message: string };

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
  const [sample, setSample] = useState<SampleState>({ status: 'idle' });
  const sampleImport = useRef<SampleImport | null>(null);
  // `sample` state lags behind by one render, so a fast double tap needs its own guard:
  // two imports would otherwise unpack into the same scratch directory.
  const sampleRunning = useRef(false);

  const demoProject = findSampleProject(projects);
  const sampleBusy = sample.status === 'downloading' || sample.status === 'importing';
  const showSample = projects.length === 0 || Boolean(demoProject);

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

  const handleSampleProgress = (progress: SampleProgress) => {
    if (progress.kind === 'download') {
      setSample({ status: 'downloading', received: progress.received, total: progress.total });
    } else {
      // Import events fire per file batch; only switch state once.
      setSample((current) => (current.status === 'importing' ? current : { status: 'importing' }));
    }
  };

  /**
   * Open the demo library: an existing import wins, otherwise the archive is downloaded
   * once (when not cached) and imported through the regular archive pipeline.
   */
  const openSample = () => {
    if (sampleRunning.current || sampleBusy) return;
    if (demoProject) {
      onOpen(demoProject);
      return;
    }
    if (readOnly || busy) return;
    setError(null);
    sampleRunning.current = true;
    setSample({ status: 'downloading', received: 0, total: 0 });
    const handle = importSampleProject(handleSampleProgress);
    sampleImport.current = handle;
    handle.promise
      .then((result) => {
        sampleImport.current = null;
        sampleRunning.current = false;
        setSample({ status: 'idle' });
        onImported(result.project);
      })
      .catch((reason: unknown) => {
        sampleImport.current = null;
        sampleRunning.current = false;
        if (reason instanceof SampleCancelledError) {
          setSample({ status: 'idle' });
          return;
        }
        setSample({
          status: 'error',
          message: reason instanceof Error ? reason.message : String(reason),
        });
      });
  };

  const cancelSample = () => {
    sampleImport.current?.cancel();
    sampleImport.current = null;
    sampleRunning.current = false;
    setSample({ status: 'idle' });
  };

  const confirmDelete = (project: StoredProject) => {
    const sampleProject = isSampleProject(project);
    Alert.alert(
      t('home.deleteTitle'),
      t(sampleProject ? 'home.deleteSampleBody' : 'home.deleteBody'),
      [
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
      ],
    );
  };

  const downloadPercent =
    sample.status === 'downloading' && sample.total > 0
      ? Math.min(100, Math.round((sample.received / sample.total) * 100))
      : 0;
  const downloadLabel =
    sample.status === 'downloading'
      ? sample.total > 0
        ? t('home.sampleDownloading', {
            received: formatSize(sample.received),
            total: formatSize(sample.total),
          })
        : t('home.sampleDownloadingUnknown', { received: formatSize(sample.received) })
      : '';

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
            disabled={readOnly || sampleBusy}
          />
          {showSample ? (
            <Button
              label={t('home.sampleOpen')}
              variant="secondary"
              onPress={openSample}
              busy={sampleBusy}
              disabled={Boolean(busy) || (readOnly && !demoProject)}
            />
          ) : null}
        </View>

        {showSample && !demoProject && !sampleBusy && sample.status !== 'error' ? (
          <Text style={styles.sampleHint}>
            {t('home.sampleHint', { size: formatSize(SAMPLE_APPROX_BYTES) })}
          </Text>
        ) : null}

        {sample.status === 'downloading' ? (
          <View style={styles.progress}>
            <Text style={styles.busy}>{downloadLabel}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${downloadPercent}%` }]} />
            </View>
            <Button label={t('common.cancel')} variant="ghost" onPress={cancelSample} />
          </View>
        ) : null}

        {sample.status === 'importing' ? <Text style={styles.busy}>{t('home.importing')}</Text> : null}

        {sample.status === 'error' ? (
          <View style={styles.sampleError}>
            <Banner text={sample.message} tone="error" />
            <Button label={t('common.retry')} variant="secondary" onPress={openSample} />
          </View>
        ) : null}

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
                {isSampleProject(project) ? <Badge label={t('home.sampleBadge')} tone="accent" /> : null}
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
  sampleHint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  busy: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  progress: { gap: spacing.sm, alignItems: 'stretch' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
  sampleError: { gap: spacing.sm, alignItems: 'stretch' },
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
