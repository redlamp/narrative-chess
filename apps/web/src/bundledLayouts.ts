/**
 * Bundles the committed layout JSON files from /layouts/ into the Vite build
 * via import.meta.glob. This ensures:
 *   - GitHub Pages deployments always ship the project's current layout defaults
 *   - The Reset action can restore state to these committed defaults without
 *     requiring a connected local folder
 *
 * Path: apps/web/src/ → ../../../layouts/
 */

import { normalizePageLayoutFileRecord, type PageLayoutFileRecord } from "./pageLayoutFiles";
import { normalizeWorkspaceLayoutFileRecord, type WorkspaceLayoutFileRecord } from "./layoutFiles";
import type { PageLayoutPanelId, PageLayoutVariant } from "./pageLayoutState";

// Eager import — all JSONs are embedded in the bundle at build time
const allLayoutFiles = import.meta.glob("../../../layouts/*.json", {
  eager: true,
  import: "default"
}) as Record<string, unknown>;

function getFileName(fullPath: string): string {
  return fullPath.split("/").at(-1) ?? fullPath;
}

export function getBundledPageLayout(input: {
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
}): PageLayoutFileRecord | null {
  for (const [fullPath, data] of Object.entries(allLayoutFiles)) {
    const fileName = getFileName(fullPath);
    if (!fileName.endsWith(".page-layout.json")) continue;
    if (!fileName.startsWith(`${input.layoutKey}--`)) continue;

    return normalizePageLayoutFileRecord({
      value: data,
      layoutKey: input.layoutKey,
      layoutVariant: input.layoutVariant,
      panelIds: input.panelIds
    });
  }
  return null;
}

export function getBundledWorkspaceLayout(name: string): WorkspaceLayoutFileRecord | null {
  const targetFileName = `${name}.workspace-layout.json`;

  for (const [fullPath, data] of Object.entries(allLayoutFiles)) {
    const fileName = getFileName(fullPath);
    if (fileName !== targetFileName) continue;

    return normalizeWorkspaceLayoutFileRecord(data);
  }
  return null;
}
