import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

type NumberStepperFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function NumberStepperField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: NumberStepperFieldProps) {
  const [draftValue, setDraftValue] = useState(() => String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const updateValue = (nextValue: number) => {
    onChange(clamp(Math.round(nextValue), min, max));
  };

  const commitDraftValue = () => {
    const nextValue = Number(draftValue);
    if (Number.isFinite(nextValue)) {
      updateValue(nextValue);
      return;
    }

    setDraftValue(String(value));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }

    if (event.key === "Escape") {
      setDraftValue(String(value));
      event.currentTarget.blur();
    }
  };

  return (
    <label className="stepper-field">
      <span className="field-label stepper-field__label">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        onChange={(event) => setDraftValue(event.currentTarget.value)}
        onBlur={commitDraftValue}
        onKeyDown={handleKeyDown}
        className="stepper-field__input"
        aria-label={label}
      />
    </label>
  );
}
