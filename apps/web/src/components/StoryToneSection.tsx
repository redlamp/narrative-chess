import { Button } from "@/components/ui/button";

type StoryToneSectionProps = {
  tonePreset: "grounded" | "civic-noir" | "dark-comedy";
  onToneChange: (tone: "grounded" | "civic-noir" | "dark-comedy") => void;
  showLabel?: boolean;
  inline?: boolean;
};

export function StoryToneSection({
  tonePreset,
  onToneChange,
  showLabel = true,
  inline = false
}: StoryToneSectionProps) {
  return (
    <>
      {showLabel ? <p className="field-label">Narrative Tone</p> : null}
      <div className={`tone-switcher ${inline ? "tone-switcher--inline" : ""}`}>
        <Button
          type="button"
          variant={tonePreset === "grounded" ? "secondary" : "outline"}
          size={inline ? "xs" : "sm"}
          onClick={() => onToneChange("grounded")}
        >
          Grounded
        </Button>
        <Button
          type="button"
          variant={tonePreset === "civic-noir" ? "secondary" : "outline"}
          size={inline ? "xs" : "sm"}
          onClick={() => onToneChange("civic-noir")}
        >
          Civic noir
        </Button>
        <Button
          type="button"
          variant={tonePreset === "dark-comedy" ? "secondary" : "outline"}
          size={inline ? "xs" : "sm"}
          onClick={() => onToneChange("dark-comedy")}
        >
          Dark comedy
        </Button>
      </div>
    </>
  );
}
