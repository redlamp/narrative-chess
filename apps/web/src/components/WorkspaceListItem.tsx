import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceListItemProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  selected?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title">;

export function WorkspaceListItem({
  title,
  description,
  meta,
  leading,
  selected = false,
  className,
  type = "button",
  ...buttonProps
}: WorkspaceListItemProps) {
  return (
    <li className="workspace-list-item__entry">
      <button
        type={type}
        {...buttonProps}
        aria-pressed={selected}
        className={cn("workspace-list-item", selected ? "is-selected" : null, className)}
      >
        <div className="workspace-list-item__main">
          <div className="workspace-list-item__title-row">
            {leading ? (
              <span aria-hidden="true" className="workspace-list-item__leading">
                {leading}
              </span>
            ) : null}
            <span className="workspace-list-item__title">{title}</span>
          </div>
          {description ? (
            <p className="workspace-list-item__description">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="workspace-list-item__meta">{meta}</div> : null}
      </button>
    </li>
  );
}
