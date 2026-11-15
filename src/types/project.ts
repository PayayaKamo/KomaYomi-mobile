import type {
  ChapterEntry,
  Library,
  PageDoc,
  PageEntry,
  PageKind,
  ReadingDirection,
  VolumeEntry,
  Lang,
} from '../shared/types';

/** Image entry inside `manifest.json` of a `.mnproj` archive. */
export type ManifestImage = {
  volume: string;
  chapter: string;
  pageIndex: number;
  lang: string;
  name: string;
  sha1?: string;
  size?: number;
  /** Reference mode: path relative to the picked image root. */
  path?: string;
  /** Packaged mode: path inside the archive, usually `assets/<sha1>.<ext>`. */
  asset?: string;
};

export type ManifestInventoryVolume = {
  volume: string;
  languages?: string[];
  langDirs?: Record<string, string>;
  chapters?: { chapter: string; pages?: number; images?: number }[];
};

export type ProjectManifest = {
  schemaVersion: number;
  storageMode: 'reference' | 'packaged';
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  appVersion?: string;
  language?: { volumes?: Record<string, Record<string, string>>; resolved?: Record<string, Record<string, string>> };
  inventory: { volumes: ManifestInventoryVolume[]; images: ManifestImage[]; pageCount?: number };
};

/** `config/library.json` payload inside a project archive. */
export type LibraryConfig = {
  volumes?: Record<
    string,
    {
      title?: string;
      dirs?: Partial<Record<Lang, string>>;
      defaultDirection?: ReadingDirection;
      chapters?: Record<
        string,
        { title?: string; order?: number[]; excluded?: number[]; kinds?: Record<string, string> }
      >;
    }
  >;
  langOrder?: Lang[];
};

/** Persisted project row (SQLite `projects`). */
export type StoredProject = {
  id: string;
  name: string;
  storageMode: 'reference' | 'packaged';
  sourceFile: string;
  importedAt: string;
  /** Archive root on disk: `<DocumentDirectory>/projects/<id>`. */
  directory: string;
  manifest: ProjectManifest;
  config: LibraryConfig;
  library: Library;
  warnings: string[];
};

/** Image row (SQLite `images`). */
export type StoredImage = {
  projectId: string;
  volume: string;
  chapter: string;
  pageIndex: number;
  lang: string;
  name: string;
  localPath: string;
  size: number;
};

export type PageDocMap = Record<string, PageDoc>;

export type ImportResult = {
  project: StoredProject;
  pages: number;
  images: number;
  missingImages: number;
  warnings: string[];
};

export type { ChapterEntry, Library, PageDoc, PageEntry, PageKind, ReadingDirection, VolumeEntry, Lang };
