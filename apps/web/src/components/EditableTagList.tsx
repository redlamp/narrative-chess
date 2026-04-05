import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditableTagListProps = {
  title: string;
  description: string;
  items: string[];
  placeholder: string;
  addLabel: string;
  emptyText: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

export function EditableTagList({
  title,
  description,
  items,
  placeholder,
  addLabel,
  emptyText,
  onAdd,
  onRemove
}: EditableTagListProps) {
  const [draftValue, setDraftValue] = useState("");

  const commitValue = () => {
    const nextValue = draftValue.trim();
    if (!nextValue || items.includes(nextValue)) {
      return;
    }

    onAdd(nextValue);
    setDraftValue("");
  };

  return (
    <div className="editable-tag-list">
      <div className="grid gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="editable-tag-list__chips" aria-label={title}>
        {items.length ? (
          items.map((item) => (
            <button
              key={item}
              type="button"
              className="editable-tag-list__chip"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${title.toLowerCase()} tag ${item}`}
            >
              <span className="editable-tag-list__chip-label">{item}</span>
              <X data-icon="inline-end" />
            </button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>

      <div className="editable-tag-list__editor">
        <Input
          value={draftValue}
          onChange={(event) => setDraftValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitValue();
            }
          }}
          placeholder={placeholder}
          aria-label={title}
        />
        <Button type="button" variant="outline" onClick={commitValue}>
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
