import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { StoredProject } from './src/types/project';
import { detectLocale, setLocale, t } from './src/i18n';
import { initDatabase, listProjects, touchProject } from './src/lib/db';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { PagesScreen } from './src/screens/PagesScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { colors, spacing } from './src/theme';

setLocale(detectLocale());

type RouteInput =
  | { name: 'home' }
  | { name: 'library'; projectId: string }
  | { name: 'pages'; projectId: string; volumeId: string; chapterId: string }
  | { name: 'reader'; projectId: string; volumeId: string; chapterId: string; pageIndex: number }
  | { name: 'note'; projectId: string; volumeId: string; chapterId: string; pageIndex: number };

type Route = RouteInput & { key: string };

let routeCounter = 0;
const routeKey = () => `r${(routeCounter += 1)}`;

export default function App() {
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [stack, setStack] = useState<Route[]>([{ name: 'home', key: routeKey() }]);

  const refresh = useCallback(async () => {
    const rows = await listProjects();
    setProjects(rows);
    return rows;
  }, []);

  useEffect(() => {
    initDatabase()
      .then(refresh)
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setFatal(reason instanceof Error ? reason.message : String(reason));
        setReady(true);
      });
  }, [refresh]);

  const pop = useCallback(() => {
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const push = useCallback((route: RouteInput) => {
    setStack((current) => [...current, { ...route, key: routeKey() }]);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        pop();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [stack.length, pop]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (fatal) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Text style={styles.fatalTitle}>{t('common.error')}</Text>
          <Text style={styles.fatalText}>{fatal}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  const route = stack[stack.length - 1];
  const project = 'projectId' in route ? projects.find((item) => item.id === route.projectId) : undefined;

  const openProject = (item: StoredProject) => {
    touchProject(item.id).catch(() => undefined);
    push({ name: 'library', projectId: item.id });
  };

  let content: React.ReactNode;
  if (route.name === 'home') {
    content = (
      <HomeScreen
        projects={projects}
        onOpen={openProject}
        onImported={async (imported) => {
          await refresh();
          push({ name: 'library', projectId: imported.id });
        }}
        onDelete={() => {
          refresh().catch(() => undefined);
        }}
      />
    );
  } else if (!project) {
    content = (
      <View style={styles.loading}>
        <Text style={styles.fatalTitle}>{t('common.error')}</Text>
        <Text style={styles.fatalText}>This project is no longer available.</Text>
      </View>
    );
  } else if (route.name === 'library') {
    content = (
      <LibraryScreen
        project={project}
        onBack={pop}
        onOpenChapter={(volumeId, chapterId) => push({ name: 'pages', projectId: project.id, volumeId, chapterId })}
      />
    );
  } else if (route.name === 'pages') {
    content = (
      <PagesScreen
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        onBack={pop}
        onOpenPage={(pageIndex) =>
          push({ name: 'reader', projectId: project.id, volumeId: route.volumeId, chapterId: route.chapterId, pageIndex })
        }
      />
    );
  } else if (route.name === 'reader') {
    content = (
      <ReaderScreen
        key={`${route.projectId}/${route.volumeId}/${route.chapterId}`}
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        initialPageIndex={route.pageIndex}
        onBack={pop}
        onOpenNote={(pageIndex) =>
          push({ name: 'note', projectId: project.id, volumeId: route.volumeId, chapterId: route.chapterId, pageIndex })
        }
        onPageChange={(pageIndex) => {
          setStack((current) =>
            current.map((item, index) =>
              index === current.length - 1 && item.name === 'reader' ? { ...item, pageIndex } : item,
            ),
          );
        }}
      />
    );
  } else {
    content = (
      <NotesScreen
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        pageIndex={route.pageIndex}
        onBack={pop}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar barStyle="light-content" />
        <View style={styles.root}>{content}</View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: { color: colors.textMuted, fontSize: 12 },
  fatalTitle: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  fatalText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
