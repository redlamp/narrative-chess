import { Button } from "@/components/ui/button";

type StoryToneSectionProps = {
  tonePreset: "grounded" | "civic-noir" | "dark-comedy";
  onToneChange: (tone: "grounded" | "civic-noir" | "dark-comedy") => void;
};

export function StoryToneSection({
  tonePreset,
  onToneChange
}: StoryToneSectionProps) {
  return (
    <>
      <p className="field-label">Narrative Tone</p>
      <div className="tone-switcher">
        <Button
          type="button"
          variant={tonePreset === "grounded" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onToneChange("grounded")}
        >
          Grounded
        </Button>
        <Button
          type="button"
          variant={tonePreset === "civic-noir" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onToneChange("civic-noir")}
        >
          Civic noir
        </Button>
        <Button
          type="button"
          variant={tonePreset === "dark-comedy" ? "secondary" : "outline"}
          size="sm"
          onClick={() => onToneChange("dark-comedy")}
        >
          Dark comedy
        </Button>
      </div>
    </>
  );
}
