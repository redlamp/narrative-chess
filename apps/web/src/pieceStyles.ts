const storageKey = "narrative-chess:piece-styles:v1";

export const defaultPieceStyleSheet = `:root {
  --narrative-piece-shadow: 0 1px 0 rgb(255 255 255 / 0.35), 0 10px 18px rgb(15 23 42 / 0.12);
  --narrative-piece-white-outline: rgb(15 23 42 / 0.92);
  --narrative-piece-black-outline: rgb(248 250 252 / 0.96);
  --narrative-piece-hover-lift: translateY(-1px);
}

.board-square__piece,
.piece-badge__icon {
  text-shadow: var(--narrative-piece-shadow);
}

.board-square__piece.is-white,
.piece-badge__icon--white {
  -webkit-text-stroke: 1px var(--narrative-piece-white-outline);
}

.board-square__piece.is-black,
.piece-badge__icon--black {
  -webkit-text-stroke: 1px var(--narrative-piece-black-outline);
}

.board-square:hover .board-square__piece,
.board-square:focus-visible .board-square__piece,
.board-square--selected .board-square__piece,
.board-square--inspected .board-square__piece {
  transform: var(--narrative-piece-hover-lift);
  filter: drop-shadow(0 10px 16px rgb(15 23 42 / 0.14));
}

.piece-badge__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
`;

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function normalizePieceStyleSheet(value: unknown) {
  return typeof value === "string" && value.trim() ? value : defaultPieceStyleSheet;
}

export function listPieceStyleSheet() {
  const storage = getStorage();
  if (!storage) {
    return defaultPieceStyleSheet;
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return defaultPieceStyleSheet;
  }

  return normalizePieceStyleSheet(rawValue);
}

export function savePieceStyleSheet(cssText: string) {
  const nextCssText = normalizePieceStyleSheet(cssText);
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, nextCssText);
  }

  return nextCssText;
}

export function resetPieceStyleSheet() {
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, defaultPieceStyleSheet);
  }

  return defaultPieceStyleSheet;
}

export function applyPieceStyleSheet(cssText: string) {
  if (typeof document === "undefined") {
    return;
  }

  let styleElement = document.getElementById("narrative-piece-style-sheet") as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "narrative-piece-style-sheet";
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = cssText;
}
