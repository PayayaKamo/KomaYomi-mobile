import { open, type DB } from '@op-engineering/op-sqlite';
import type { Lang, PageDoc } from '../shared/types';
import type { LibraryConfig, ProjectManifest, StoredImage, StoredProject } from '../types/project';

let database: DB | null = null;

function getDb(): DB {
  if (!database) database = open({ name: 'komayomi.db' });
  return database;
}

export async function initDatabase(): Promise<void> {
  const db = getDb();
  await db.execute('PRAGMA journal_mode = WAL');
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    storage_mode TEXT NOT NULL,
    source_file TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    directory TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    config_json TEXT NOT NULL,
    library_json TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    last_opened_at TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS images (
    project_id TEXT NOT NULL,
    volume TEXT NOT NULL,
    chapter TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    lang TEXT NOT NULL,
    name TEXT NOT NULL,
    local_path TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, volume, chapter, page_index, lang)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS pages (
    project_id TEXT NOT NULL,
    volume TEXT NOT NULL,
    chapter TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    doc_json TEXT NOT NULL,
    PRIMARY KEY (project_id, volume, chapter, page_index)
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS notes (
    project_id TEXT NOT NULL,
    volume TEXT NOT NULL,
    chapter TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    text TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (project_id, volume, chapter, page_index)
  )`);
  await db.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
  await db.execute('PRAGMA user_version = 1');
}

const json = (value: unknown) => JSON.stringify(value);
const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type ProjectRow = {
  id: string;
  name: string;
  storage_mode: string;
  source_file: string;
  imported_at: string;
  directory: string;
  manifest_json: string;
  config_json: string;
  library_json: string;
  warnings_json: string;
};

function rowToProject(row: ProjectRow): StoredProject {
  return {
    id: row.id,
    name: row.name,
    storageMode: row.storage_mode === 'packaged' ? 'packaged' : 'reference',
    sourceFile: row.source_file,
    importedAt: row.imported_at,
    directory: row.directory,
    manifest: parseJson<ProjectManifest>(row.manifest_json, { schemaVersion: 1, storageMode: 'reference', inventory: { volumes: [], images: [] } }),
    config: parseJson<LibraryConfig>(row.config_json, {}),
    library: parseJson<StoredProject['library']>(row.library_json, { root: '', languages: [], langOrder: [], volumes: [] }),
    warnings: parseJson<string[]>(row.warnings_json, []),
  };
}

export async function listProjects(): Promise<StoredProject[]> {
  const result = await getDb().execute('SELECT * FROM projects ORDER BY COALESCE(last_opened_at, imported_at) DESC');
  return (result.rows as unknown as ProjectRow[]).map(rowToProject);
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const result = await getDb().execute('SELECT * FROM projects WHERE id = ?', [id]);
  const row = (result.rows as unknown as ProjectRow[])[0];
  return row ? rowToProject(row) : null;
}

export async function touchProject(id: string): Promise<void> {
  await getDb().execute('UPDATE projects SET last_opened_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

export async function insertProject(project: StoredProject): Promise<void> {
  await getDb().execute(
    `INSERT INTO projects
      (id, name, storage_mode, source_file, imported_at, directory, manifest_json, config_json, library_json, warnings_json, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.name,
      project.storageMode,
      project.sourceFile,
      project.importedAt,
      project.directory,
      json(project.manifest),
      json(project.config),
      json(project.library),
      json(project.warnings),
      project.importedAt,
    ],
  );
}

export async function insertImages(images: StoredImage[]): Promise<void> {
  if (!images.length) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const image of images) {
      await tx.execute(
        `INSERT OR REPLACE INTO images (project_id, volume, chapter, page_index, lang, name, local_path, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          image.projectId,
          image.volume,
          image.chapter,
          image.pageIndex,
          image.lang,
          image.name,
          image.localPath,
          image.size,
        ],
      );
    }
  });
}

export async function getImages(projectId: string): Promise<StoredImage[]> {
  const result = await getDb().execute('SELECT * FROM images WHERE project_id = ?', [projectId]);
  return (result.rows as unknown as Record<string, unknown>[]).map((row) => ({
    projectId: String(row.project_id),
    volume: String(row.volume),
    chapter: String(row.chapter),
    pageIndex: Number(row.page_index),
    lang: String(row.lang),
    name: String(row.name),
    localPath: String(row.local_path),
    size: Number(row.size) || 0,
  }));
}

export async function insertPages(projectId: string, docs: PageDoc[]): Promise<void> {
  if (!docs.length) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    for (const doc of docs) {
      await tx.execute(
        `INSERT OR REPLACE INTO pages (project_id, volume, chapter, page_index, doc_json) VALUES (?, ?, ?, ?, ?)`,
        [projectId, doc.volume, doc.chapter, doc.pageIndex, json(doc)],
      );
    }
  });
}

export async function getPageDocs(projectId: string, volume: string, chapter: string): Promise<Record<string, PageDoc>> {
  const result = await getDb().execute(
    'SELECT page_index, doc_json FROM pages WHERE project_id = ? AND volume = ? AND chapter = ?',
    [projectId, volume, chapter],
  );
  const out: Record<string, PageDoc> = {};
  for (const row of result.rows as unknown as Record<string, unknown>[]) {
    out[String(Number(row.page_index))] = parseJson<PageDoc>(row.doc_json, {
      schemaVersion: 1,
      volume,
      chapter,
      pageIndex: Number(row.page_index),
      panels: [],
      notes: [],
      offsets: {},
      alignMode: 'page',
      panelOffsets: {},
      readingDirection: 'rtl',
      updatedAt: '',
    });
  }
  return out;
}

export async function getNote(
  projectId: string,
  volume: string,
  chapter: string,
  pageIndex: number,
): Promise<string> {
  const result = await getDb().execute(
    'SELECT text FROM notes WHERE project_id = ? AND volume = ? AND chapter = ? AND page_index = ?',
    [projectId, volume, chapter, pageIndex],
  );
  const row = (result.rows as unknown as { text?: string }[])[0];
  return row?.text ?? '';
}

export async function saveNote(
  projectId: string,
  volume: string,
  chapter: string,
  pageIndex: number,
  text: string,
): Promise<void> {
  await getDb().execute(
    `INSERT INTO notes (project_id, volume, chapter, page_index, text, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, volume, chapter, page_index)
     DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    [projectId, volume, chapter, pageIndex, text, new Date().toISOString()],
  );
}

export async function getAnnotatedPages(projectId: string): Promise<Set<string>> {
  const result = await getDb().execute(
    "SELECT volume, chapter, page_index FROM notes WHERE project_id = ? AND text != ''",
    [projectId],
  );
  const set = new Set<string>();
  for (const row of result.rows as unknown as Record<string, unknown>[]) {
    set.add(`${String(row.volume)}/${String(row.chapter)}/${Number(row.page_index)}`);
  }
  return set;
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM notes WHERE project_id = ?', [projectId]);
    await tx.execute('DELETE FROM pages WHERE project_id = ?', [projectId]);
    await tx.execute('DELETE FROM images WHERE project_id = ?', [projectId]);
    await tx.execute('DELETE FROM projects WHERE id = ?', [projectId]);
  });
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await getDb().execute('SELECT value FROM settings WHERE key = ?', [key]);
  const row = (result.rows as unknown as { value?: string }[])[0];
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb().execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

/** Language order persisted per project, so a later visit keeps the user's column order. */
export async function getLangOrder(projectId: string): Promise<Lang[] | null> {
  const raw = await getSetting(`langOrder:${projectId}`);
  return raw ? (parseJson<Lang[]>(raw, []) as Lang[]) : null;
}

export async function saveLangOrder(projectId: string, order: Lang[]): Promise<void> {
  await setSetting(`langOrder:${projectId}`, json(order));
}
