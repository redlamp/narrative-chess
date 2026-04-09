import { Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClearableSearchFieldProps = {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  name: string;
};

export function ClearableSearchField({
  label,
  value,
  onChange,
  placeholder,
  ariaLabel,
  name
}: ClearableSearchFieldProps) {
  return (
    <label className="grid gap-2">
      {label ? <span className="text-sm font-medium">{label}</span> : null}
      <div className="clearable-search-field">
        <Input
          name={name}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="clearable-search-field__input"
        />
        <div className="clearable-search-field__actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
            onClick={() => onChange("")}
            disabled={!value}
            className={value ? "clearable-search-field__clear" : "clearable-search-field__clear is-hidden"}
          >
            <X />
          </Button>
          <Search aria-hidden="true" className="clearable-search-field__icon" />
        </div>
      </div>
    </label>
  );
}
