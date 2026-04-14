import type { ReactNode } from "react";
import {
  SharedLayoutToolbar,
  type SharedLayoutFileNotice,
  type SharedLayoutPresetEntry
} from "./SharedLayoutToolbar";
import type { PointerEvent as ReactPointerEvent } from "react";

type PageLayoutToolbarComponent = {
  id: string;
  label: string;
  visible: boolean;
};

type PageLayoutPageOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type PageLayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  components: PageLayoutToolbarComponent[];
  pages?: PageLayoutPageOption[];
  activePage?: string;
  onPageChange?: (page: string) => void;
  presets: SharedLayoutPresetEntry[];
  onCreatePreset: () => void;
  onSavePreset: () => void;
  onActivatePreset: (id: string) => void;
  onTogglePresetHidden: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (id: string, name: string) => void;
  onReorderPreset: (id: string, targetId: string) => void;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  onLayoutFileNameChange: (value: string) => void;
  onConnectLayoutDirectory: () => void;
  onSaveLayoutBundle: () => void;
  onLoadLayoutBundle: () => void;
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  isDragging?: boolean;
  onToggleLayoutMode: () => void;
  onColumnCountChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onRestoreComponent: (id: string) => void;
  onToggleComponentVisibility: (id: string, visible: boolean) => void;
  onResetLayout: () => void;
};

export function PageLayoutToolbar(props: PageLayoutToolbarProps) {
  return (
    <SharedLayoutToolbar
      {...props}
      components={props.components}
    />
  );
}
