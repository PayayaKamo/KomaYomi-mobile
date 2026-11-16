import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { StoredProject } from './src/types/project';
import { detectLocale, setLocale, t } from './src/i18n';
import {
  getSetting,
  initDatabase,
  listProjects,
  setSetting,
  touchProject,
} from './src/lib/db';
import { parseDeepLink, type ReaderView } from './src/lib/deeplink';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { PagesScreen } from './src/screens/PagesScreen';
import { ReaderScreen } from './src/screens/ReaderScreen';
import { NotesScreen } from './src/screens/NotesScreen';
import { PanelDetailScreen } from './src/screens/PanelDetailScreen';
import { colors, spacing } from './src/theme';

setLocale(detectLocale());

export type AppMode = 'edit' | 'read';

type RouteInput =
  | { name: 'home' }
  | { name: 'library'; projectId: string }
  | { name: 'pages'; projectId: string; volumeId: string; chapterId: string }
  | {
      name: 'reader';
      projectId: string;
      volumeId: string;
      chapterId: string;
      pageIndex: number;
      view: ReaderView;
    }
  | {
      name: 'panel';
      projectId: string;
      volumeId: string;
      chapterId: string;
      pageIndex: number;
      panelId: string | null;
    }
  | {
      name: 'note';
      projectId: string;
      volumeId: string;
      chapterId: string;
      pageIndex: number;
    };

type Route = RouteInput & { key: string };

let routeCounter = 0;
const routeKey = () => `r${(routeCounter += 1)}`;

export default function App() {
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [appMode, setAppMode] = useState<AppMode>('edit');
  const [stack, setStack] = useState<Route[]>([{ name: 'home', key: routeKey() }]);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const refresh = useCallback(async () => {
    const rows = await listProjects();
    setProjects(rows);
    return rows;
  }, []);

  useEffect(() => {
    initDatabase()
      .then(async () => {
        const stored = await getSetting('appMode');
        if (stored === 'read' || stored === 'edit') setAppMode(stored);
        await refresh();
      })
      .then(() => setReady(true))
      .catch((reason: unknown) => {
        setFatal(reason instanceof Error ? reason.message : String(reason));
        setReady(true);
      });
  }, [refresh]);

  const pop = useCallback(() => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  const push = useCallback((route: RouteInput) => {
    setStack(current => [...current, { ...route, key: routeKey() }]);
  }, []);

  const changeMode = useCallback((next: AppMode) => {
    setAppMode(next);
    setSetting('appMode', next).catch(() => undefined);
  }, []);

  /** Custom-scheme link -> the same page and view a shared link points at. */
  const openDeepLink = useCallback((raw: string | null) => {
    const link = parseDeepLink(raw);
    if (!link) return;
    const list = projectsRef.current;
    const project =
      list.find(item =>
        item.library.volumes.some(
          volume =>
            volume.id === link.volume &&
            volume.chapters.some(chapter => chapter.chapter === link.chapter),
        ),
      ) ?? list.find(item => item.library.volumes.some(volume => volume.id === link.volume));
    if (!project) return;
    const volume = project.library.volumes.find(item => item.id === link.volume);
    const chapter =
      volume?.chapters.find(item => item.chapter === link.chapter) ??
      volume?.chapters[0];
    if (!volume || !chapter) return;

    const pages = chapter.pages.filter(page => !page.excluded);
    const page = pages[Math.min(Math.max(link.pageIndex, 0), pages.length - 1)];
    const pageIndex = page?.index ?? 0;

    touchProject(project.id).catch(() => undefined);
    const next: Route[] = [
      { name: 'home', key: routeKey() },
      { name: 'library', projectId: project.id, key: routeKey() },
      {
        name: 'pages',
        projectId: project.id,
        volumeId: volume.id,
        chapterId: chapter.chapter,
        key: routeKey(),
      },
      {
        name: 'reader',
        projectId: project.id,
        volumeId: volume.id,
        chapterId: chapter.chapter,
        pageIndex,
        view: link.view,
        key: routeKey(),
      },
    ];
    if (link.panelId) {
      next.push({
        name: 'panel',
        projectId: project.id,
        volumeId: volume.id,
        chapterId: chapter.chapter,
        pageIndex,
        panelId: link.panelId,
        key: routeKey(),
      });
    }
    setStack(next);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    Linking.getInitialURL()
      .then(url => openDeepLink(url ?? null))
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', event =>
      openDeepLink(event.url),
    );
    return () => subscription.remove();
  }, [ready, openDeepLink]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (stack.length > 1) {
          pop();
          return true;
        }
        return false;
      },
    );
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
  const project =
    'projectId' in route
      ? projects.find(item => item.id === route.projectId)
      : undefined;
  const readOnly = appMode === 'read';

  const openProject = (item: StoredProject) => {
    touchProject(item.id).catch(() => undefined);
    push({ name: 'library', projectId: item.id });
  };

  const updatePanelRoute = (pageIndex: number, panelId: string | null) => {
    setStack(current =>
      current.map((item, index) => {
        if (index === current.length - 1 && item.name === 'panel') {
          return { ...item, pageIndex, panelId };
        }
        if (index === current.length - 2 && item.name === 'reader') {
          return { ...item, pageIndex };
        }
        return item;
      }),
    );
  };

  let content: React.ReactNode;
  if (route.name === 'home') {
    content = (
      <HomeScreen
        projects={projects}
        readOnly={readOnly}
        onModeChange={changeMode}
        onOpen={openProject}
        onImported={async imported => {
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
        <Text style={styles.fatalText}>{t('common.projectMissing')}</Text>
      </View>
    );
  } else if (route.name === 'library') {
    content = (
      <LibraryScreen
        project={project}
        readOnly={readOnly}
        onModeChange={changeMode}
        onBack={pop}
        onOpenChapter={(volumeId, chapterId) =>
          push({
            name: 'pages',
            projectId: project.id,
            volumeId,
            chapterId,
          })
        }
      />
    );
  } else if (route.name === 'pages') {
    content = (
      <PagesScreen
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        onBack={pop}
        onOpenPage={pageIndex =>
          push({
            name: 'reader',
            projectId: project.id,
            volumeId: route.volumeId,
            chapterId: route.chapterId,
            pageIndex,
            view: 'compare',
          })
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
        view={route.view}
        readOnly={readOnly}
        onModeChange={changeMode}
        onViewChange={view =>
          setStack(current =>
            current.map((item, index) =>
              index === current.length - 1 && item.name === 'reader'
                ? { ...item, view }
                : item,
            ),
          )
        }
        onBack={pop}
        onOpenNote={pageIndex =>
          push({
            name: 'note',
            projectId: project.id,
            volumeId: route.volumeId,
            chapterId: route.chapterId,
            pageIndex,
          })
        }
        onOpenPanel={(pageIndex, panelId) =>
          push({
            name: 'panel',
            projectId: project.id,
            volumeId: route.volumeId,
            chapterId: route.chapterId,
            pageIndex,
            panelId,
          })
        }
        onPageChange={pageIndex => {
          setStack(current =>
            current.map((item, index) =>
              index === current.length - 1 && item.name === 'reader'
                ? { ...item, pageIndex }
                : item,
            ),
          );
        }}
      />
    );
  } else if (route.name === 'panel') {
    content = (
      <PanelDetailScreen
        key={`${route.projectId}/${route.volumeId}/${route.chapterId}`}
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        pageIndex={route.pageIndex}
        panelId={route.panelId}
        onBack={pop}
        onNavigate={updatePanelRoute}
      />
    );
  } else {
    content = (
      <NotesScreen
        project={project}
        volumeId={route.volumeId}
        chapterId={route.chapterId}
        pageIndex={route.pageIndex}
        readOnly={readOnly}
        onModeChange={changeMode}
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
