import {
  allPageLayoutTargets,
  listPageLayoutState,
  savePageLayoutState,
  type PageLayoutState,
  type PageLayoutTarget,
  type PageLayoutVariant,
  type PageLayoutPanelId
} from "./pageLayoutState";

export type WorkspaceLayoutBundle = {
  version: 1;
  name: string;
  savedAt: string;
  pages: Record<
    string,
    {
      layoutVariant: PageLayoutVariant;
      panelIds: PageLayoutPanelId[];
      layoutState: PageLayoutState;
    }
  >;
};

export function createWorkspaceLayoutBundle(
  name: string,
  targets: PageLayoutTarget[] = allPageLayoutTargets
): WorkspaceLayoutBundle {
  const pages: WorkspaceLayoutBundle["pages"] = {};

  for (const target of targets) {
    pages[target.layoutKey] = {
      layoutVariant: target.layoutVariant,
      panelIds: target.panelIds,
      layoutState: listPageLayoutState({
        layoutKey: target.layoutKey,
        variant: target.layoutVariant,
        panelIds: target.panelIds
      })
    };
  }

  return {
    version: 1,
    name: name.trim() || "workspace-layout",
    savedAt: new Date().toISOString(),
    pages
  };
}

export function applyWorkspaceLayoutBundle(
  bundle: WorkspaceLayoutBundle
): void {
  for (const [layoutKey, page] of Object.entries(bundle.pages)) {
    savePageLayoutState({
      layoutKey,
      layoutState: page.layoutState,
      variant: page.layoutVariant,
      panelIds: page.panelIds
    });
  }
}

export function normalizeWorkspaceLayoutBundle(
  raw: unknown
): WorkspaceLayoutBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1 || typeof record.pages !== "object" || !record.pages) return null;
  return record as unknown as WorkspaceLayoutBundle;
}
