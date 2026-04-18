import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import type { WorkspaceLayoutFileReference } from "../layoutFiles";
import {
  SharedLayoutToolbar,
  type SharedLayoutFileNotice,
  type SharedLayoutToolbarComponent
} from "./SharedLayoutToolbar";

type LayoutToolbarComponent = {
  id: string;
  label: string;
  collapsed?: boolean;
  visible: boolean;
};

type LayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: WorkspaceLayoutFileReference[];
  components: LayoutToolbarComponent[];
  pages?: Array<{ value: string; label: string; icon?: ReactNode }>;
  activePage?: string;
  onPageChange?: (page: string) => void;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  isDragging?: boolean;
  onToggleLayoutMode: () => void;
  onColumnCountChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onLayoutFileNameChange: (value: string) => void;
  onConnectLayoutDirectory: () => void;
  onLoadLayoutFile: () => void;
  onSaveLayoutFile: () => void;
  onDeleteLayoutFile: () => void;
  onSelectKnownLayoutFile: (name: string) => void;
  onRestoreComponent: (id: string) => void;
  onToggleComponentVisibility: (id: string, visible: boolean) => void;
  onResetLayout: () => void;
};

export function LayoutToolbar({ components, ...props }: LayoutToolbarProps) {
  const sharedComponents: SharedLayoutToolbarComponent[] = components.map((component) => ({
    id: component.id,
    label: component.label,
    visible: component.visible,
    statusLabel: component.collapsed ? "Collapsed" : null
  }));

  return (
    <SharedLayoutToolbar
      columnCount={props.columnCount}
      columnGap={props.columnGap}
      rowHeight={props.rowHeight}
      showLayoutGrid={props.showLayoutGrid}
      components={sharedComponents}
      pages={props.pages}
      activePage={props.activePage}
      onPageChange={props.onPageChange}
      presets={[]}
      onCreatePreset={() => {}}
      onSavePreset={() => {}}
      onActivatePreset={() => {}}
      onDeletePreset={() => {}}
      onRenamePreset={() => {}}
      onReorderPreset={() => {}}
      layoutFileName={props.layoutFileName}
      layoutDirectoryName={props.layoutDirectoryName}
      layoutFileNotice={props.layoutFileNotice}
      isLayoutDirectorySupported={props.isLayoutDirectorySupported}
      layoutFileBusyAction={props.layoutFileBusyAction}
      onLayoutFileNameChange={props.onLayoutFileNameChange}
      onConnectLayoutDirectory={props.onConnectLayoutDirectory}
      onSaveLayoutBundle={props.onSaveLayoutFile}
      onLoadLayoutBundle={props.onLoadLayoutFile}
      onDragHandlePointerDown={props.onDragHandlePointerDown}
      isDragging={props.isDragging}
      onToggleLayoutMode={props.onToggleLayoutMode}
      onColumnCountChange={props.onColumnCountChange}
      onColumnGapChange={props.onColumnGapChange}
      onRowHeightChange={props.onRowHeightChange}
      onToggleLayoutGrid={props.onToggleLayoutGrid}
      onRestoreComponent={props.onRestoreComponent}
      onToggleComponentVisibility={props.onToggleComponentVisibility}
      onResetLayout={props.onResetLayout}
    />
  );
}
