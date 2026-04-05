import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompetitiveLandscapePage } from "./CompetitiveLandscapePage";
import { PieceAssetsPage } from "./PieceAssetsPage";
import { PieceStyleReferencePage } from "./PieceStyleReferencePage";

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type ResearchPageProps = {
  pieceStyleSheet: string;
  pieceStyleDirectoryName: string | null;
  isPieceStyleDirectorySupported: boolean;
  pieceStyleFileBusyAction: string | null;
  pieceStyleFileNotice: FileNotice | null;
  onPieceStyleSheetChange: (value: string) => void;
  onConnectPieceStyleDirectory: () => void;
  onLoadPieceStyleSheetFromDirectory: () => void;
  onSavePieceStyleSheetToDirectory: () => void;
  onResetPieceStyleSheet: () => void;
};

export function ResearchPage({
  pieceStyleSheet,
  pieceStyleDirectoryName,
  isPieceStyleDirectorySupported,
  pieceStyleFileBusyAction,
  pieceStyleFileNotice,
  onPieceStyleSheetChange,
  onConnectPieceStyleDirectory,
  onLoadPieceStyleSheetFromDirectory,
  onSavePieceStyleSheetToDirectory,
  onResetPieceStyleSheet
}: ResearchPageProps) {
  const [activeTab, setActiveTab] = useState("competition");

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="research-tabs">
          <TabsList variant="line" aria-label="Research sections">
            <TabsTrigger value="competition">Competition</TabsTrigger>
            <TabsTrigger value="art-assets">Art assets</TabsTrigger>
            <TabsTrigger value="style-reference">Style reference</TabsTrigger>
          </TabsList>

          <TabsContent value="competition" className="mt-6">
            <CompetitiveLandscapePage />
          </TabsContent>

          <TabsContent value="art-assets" className="mt-6">
            <PieceAssetsPage />
          </TabsContent>

          <TabsContent value="style-reference" className="mt-6">
            <PieceStyleReferencePage
              pieceStyleSheet={pieceStyleSheet}
              pieceStyleDirectoryName={pieceStyleDirectoryName}
              isPieceStyleDirectorySupported={isPieceStyleDirectorySupported}
              pieceStyleFileBusyAction={pieceStyleFileBusyAction}
              pieceStyleFileNotice={pieceStyleFileNotice}
              onPieceStyleSheetChange={onPieceStyleSheetChange}
              onConnectPieceStyleDirectory={onConnectPieceStyleDirectory}
              onLoadPieceStyleSheetFromDirectory={onLoadPieceStyleSheetFromDirectory}
              onSavePieceStyleSheetToDirectory={onSavePieceStyleSheetToDirectory}
              onResetPieceStyleSheet={onResetPieceStyleSheet}
            />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
