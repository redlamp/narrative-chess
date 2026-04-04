import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";

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
