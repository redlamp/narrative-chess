"use client";

import { Label } from "@/components/ui/label";
import { TIME_CONTROL_PRESETS, type PresetId } from "@/lib/chess/time-controls";

type Props = {
  value: PresetId;
  onChange: (id: PresetId) => void;
  disabled?: boolean;
};

export function TimeControlPicker({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Time control</legend>
      {TIME_CONTROL_PRESETS.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <input
            type="radio"
            id={`tc-${p.id}`}
            name="timeControl"
            value={p.id}
            checked={value === p.id}
            onChange={() => onChange(p.id)}
            disabled={disabled}
          />
          <Label htmlFor={`tc-${p.id}`}>{p.label}</Label>
        </div>
      ))}
    </fieldset>
  );
}
