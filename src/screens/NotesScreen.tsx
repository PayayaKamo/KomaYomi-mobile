import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StoredProject } from '../types/project';
import { t } from '../i18n';
import { getNote, saveNote } from '../lib/db';
import { Button, Header, Screen } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export function NotesScreen({
  project,
  volumeId,
  chapterId,
  pageIndex,
  onBack,
}: {
  project: StoredProject;
  volumeId: string;
  chapterId: string;
  pageIndex: number;
  onBack: () => void;
}) {
  const volume = project.library.volumes.find((item) => item.id === volumeId);
  const chapter = volume?.chapters.find((item) => item.chapter === chapterId);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const latest = useRef(text);
  const dirty = useRef(false);
  latest.current = text;
  dirty.current = loaded && text !== saved;

  useEffect(() => {
    let alive = true;
    getNote(project.id, volumeId, chapterId, pageIndex).then((value) => {
      if (!alive) return;
      setText(value);
      setSaved(value);
      setLoaded(true);
    });
    return () => {
      alive = false;
      if (dirty.current) {
        saveNote(project.id, volumeId, chapterId, pageIndex, latest.current).catch(() => undefined);
      }
    };
  }, [project.id, volumeId, chapterId, pageIndex]);

  useEffect(() => {
    if (!loaded || text === saved) return undefined;
    const timer = setTimeout(() => {
      setSaving(true);
      saveNote(project.id, volumeId, chapterId, pageIndex, text)
        .then(() => setSaved(text))
        .catch(() => undefined)
        .finally(() => setSaving(false));
    }, 700);
    return () => clearTimeout(timer);
  }, [text, saved, loaded, project.id, volumeId, chapterId, pageIndex]);

  const subtitle = useMemo(
    () =>
      t('notes.subtitle', {
        volume: volume?.title ?? volumeId,
        chapter: chapter?.title ?? chapterId,
        page: pageIndex + 1,
      }),
    [volume, chapter, volumeId, chapterId, pageIndex],
  );

  const flush = async () => {
    if (!loaded || text === saved) return;
    setSaving(true);
    try {
      await saveNote(project.id, volumeId, chapterId, pageIndex, text);
      setSaved(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title={t('notes.title')} subtitle={subtitle} onBack={onBack} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={24}>
        <TextInput
          value={text}
          onChangeText={setText}
          onBlur={flush}
          placeholder={t('notes.placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          style={styles.input}
        />
        <View style={styles.footer}>
          <Text style={styles.status}>
            {saving ? t('common.loading') : loaded && text !== saved ? t('notes.unsaved') : t('notes.saved')}
          </Text>
          <Button label={t('notes.save')} onPress={flush} busy={saving} />
        </View>
        <Text style={styles.hint}>{t('notes.hint')}</Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  status: { color: colors.textMuted, fontSize: 12, flex: 1 },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
