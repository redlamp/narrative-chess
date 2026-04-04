import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";
import { hydrateEdinburghBoardDraft } from "./edinburghReviewState";

type LocalPermissionState = "granted" | "denied" | "prompt";

type LocalFileSystemPermissionDescriptor = {
  mode?: "read" | "readwrite";
};

type LocalFileSystemHandle = {
  kind: "file" | "directory";
  name: string;
  queryPermission?: (
    descriptor?: LocalFileSystemPermissionDescriptor
  ) => Promise<LocalPermissionState>;
  requestPermission?: (
    descriptor?: LocalFileSystemPermissionDescriptor
  ) => Promise<LocalPermissionState>;
};

type LocalFileSystemWritableFileStream = {
  write(data: string | Blob | BufferSource): Promise<void>;
  close(): Promise<void>;
};

export type LocalDirectoryHandle = LocalFileSystemHandle & {
  kind: "directory";
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<LocalDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<LocalFileHandle>;
};

type LocalFileHandle = LocalFileSystemHandle & {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<LocalFileSystemWritableFileStream>;
};

type LocalWindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<LocalDirectoryHandle>;
};

type LocalSaveTarget = {
  directoryHandle: LocalDirectoryHandle;
  fileName: string;
  displayPath: string;
  fileExists: boolean;
};

const localDraftFileName = "edinburgh-board.local.json";
const canonicalBoardFileName = "edinburgh-board.json";
const directoryDbName = "narrative-chess-local-content";
const directoryStoreName = "handles";
const edinburghDirectoryHandleKey = "edinburgh-review-directory";

type PersistedHandleRecord = {
  id: string;
  handle: LocalDirectoryHandle;
};

type LoadedDirectoryDraft = {
  board: CityBoard;
  relativePath: string;
  sourceKind: "draft" | "canonical";
};

function openDirectoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(directoryDbName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(directoryStoreName)) {
        database.createObjectStore(directoryStoreName, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the local content handle database."));
  });
}

async function readStoredDirectoryHandle() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  const database = await openDirectoryDatabase();

  return new Promise<LocalDirectoryHandle | null>((resolve, reject) => {
    const transaction = database.transaction(directoryStoreName, "readonly");
    const store = transaction.objectStore(directoryStoreName);
    const request = store.get(edinburghDirectoryHandleKey);

    request.onsuccess = () => {
      const result = request.result as PersistedHandleRecord | undefined;
      resolve(result?.handle ?? null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the saved directory handle."));
  });
}

async function writeStoredDirectoryHandle(handle: LocalDirectoryHandle) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const database = await openDirectoryDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(directoryStoreName, "readwrite");
    const store = transaction.objectStore(directoryStoreName);
    const request = store.put({
      id: edinburghDirectoryHandleKey,
      handle
    } satisfies PersistedHandleRecord);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Could not store the selected directory handle."));
  });
}

async function getOptionalDirectoryHandle(
  directoryHandle: LocalDirectoryHandle,
  name: string
) {
  try {
    return await directoryHandle.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function getOptionalFileHandle(
  directoryHandle: LocalDirectoryHandle,
  name: string
) {
  try {
    return await directoryHandle.getFileHandle(name);
  } catch {
    return null;
  }
}

async function ensureReadWritePermission(handle: LocalFileSystemHandle) {
  const descriptor = { mode: "readwrite" as const };

  if (handle.queryPermission) {
    const permission = await handle.queryPermission(descriptor);
    if (permission === "granted") {
      return;
    }
  }

  if (handle.requestPermission) {
    const permission = await handle.requestPermission(descriptor);
    if (permission === "granted") {
      return;
    }
  }

  throw new Error("Read/write permission was not granted for the selected folder.");
}

async function resolveEdinburghBoardTarget(
  rootDirectoryHandle: LocalDirectoryHandle
): Promise<LocalSaveTarget> {
  const contentDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, "content");
  if (contentDirectory) {
    const citiesDirectory = await getOptionalDirectoryHandle(contentDirectory, "cities");
    if (citiesDirectory) {
      const existingFile = await getOptionalFileHandle(citiesDirectory, localDraftFileName);
      return {
        directoryHandle: citiesDirectory,
        fileName: localDraftFileName,
        displayPath: `content/cities/${localDraftFileName}`,
        fileExists: Boolean(existingFile)
      };
    }
  }

  const directCitiesDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, "cities");
  if (directCitiesDirectory) {
    const existingFile = await getOptionalFileHandle(directCitiesDirectory, localDraftFileName);
    return {
      directoryHandle: directCitiesDirectory,
      fileName: localDraftFileName,
      displayPath: `cities/${localDraftFileName}`,
      fileExists: Boolean(existingFile)
    };
  }

  const directFile = await getOptionalFileHandle(rootDirectoryHandle, localDraftFileName);
  return {
    directoryHandle: rootDirectoryHandle,
    fileName: localDraftFileName,
    displayPath: localDraftFileName,
    fileExists: Boolean(directFile)
  };
}

export function supportsDirectoryWrite() {
  return (
    typeof window !== "undefined" &&
    typeof (window as LocalWindowWithDirectoryPicker).showDirectoryPicker === "function"
  );
}

export const supportsLocalContentDirectory = supportsDirectoryWrite;

export async function pickLocalDirectory() {
  const localWindow = window as LocalWindowWithDirectoryPicker;

  if (!supportsDirectoryWrite() || !localWindow.showDirectoryPicker) {
    throw new Error(
      "Directory save requires a browser that supports the File System Access API on localhost or HTTPS."
    );
  }

  return localWindow.showDirectoryPicker({
    mode: "readwrite"
  });
}

export async function connectEdinburghReviewDirectory() {
  const handle = await pickLocalDirectory();
  await writeStoredDirectoryHandle(handle);

  return {
    directoryName: handle.name
  };
}

export async function getConnectedEdinburghReviewDirectoryName() {
  const handle = await readStoredDirectoryHandle();
  return handle?.name ?? null;
}

export async function saveEdinburghBoardToDirectory(
  rootDirectoryHandle: LocalDirectoryHandle,
  board: CityBoard
) {
  const parsedBoard = cityBoardSchema.parse(board);
  await ensureReadWritePermission(rootDirectoryHandle);

  const target = await resolveEdinburghBoardTarget(rootDirectoryHandle);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(target.fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(parsedBoard, null, 2)}\n`);
  await writable.close();

  return {
    displayPath: target.displayPath,
    mode: target.fileExists ? "updated" : "created"
  } as const;
}

async function readJsonFile(
  directoryHandle: LocalDirectoryHandle,
  fileName: string
) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as unknown;
  } catch {
    return null;
  }
}

async function requireStoredDirectoryHandle() {
  const handle = await readStoredDirectoryHandle();

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving to disk.");
  }

  return handle;
}

export async function saveEdinburghDraftToDirectory(board: CityBoard) {
  const handle = await requireStoredDirectoryHandle();
  const result = await saveEdinburghBoardToDirectory(handle, board);

  return {
    directoryName: handle.name,
    relativePath: result.displayPath,
    mode: result.mode
  };
}

export async function loadEdinburghDraftFromDirectory(
  fallback: CityBoard
): Promise<LoadedDirectoryDraft | null> {
  const rootDirectoryHandle = await readStoredDirectoryHandle();

  if (!rootDirectoryHandle) {
    return null;
  }

  await ensureReadWritePermission(rootDirectoryHandle);

  const target = await resolveEdinburghBoardTarget(rootDirectoryHandle);
  const draftFile = await readJsonFile(target.directoryHandle, localDraftFileName);
  if (draftFile) {
    return {
      board: hydrateEdinburghBoardDraft(draftFile, fallback),
      relativePath: target.displayPath,
      sourceKind: "draft"
    };
  }

  const canonicalFile = await readJsonFile(target.directoryHandle, canonicalBoardFileName);
  if (canonicalFile) {
    return {
      board: hydrateEdinburghBoardDraft(canonicalFile, fallback),
      relativePath:
        target.displayPath === localDraftFileName
          ? canonicalBoardFileName
          : target.displayPath.replace(localDraftFileName, canonicalBoardFileName),
      sourceKind: "canonical"
    };
  }

  return null;
}
