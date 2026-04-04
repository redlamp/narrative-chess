import { useMemo, useState } from "react";
import {
  Building2,
  Download,
  FolderOpen,
  MapPinned,
  RefreshCcw,
  Save,
  Search
} from "lucide-react";
import { type ContentStatus, type ReviewStatus } from "@narrative-chess/content-schema";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { edinburghBoard } from "../edinburghBoard";
import {
  formatMultilineList,
  listEdinburghBoardDraft,
  parseMultilineList,
  resetEdinburghBoardDraft,
  saveEdinburghBoardDraft,
  updateEdinburghBoardMeta,
  updateEdinburghDistrictField
} from "../edinburghReviewState";
import {
  type LocalDirectoryHandle,
  pickLocalDirectory,
  saveEdinburghBoardToDirectory,
  supportsDirectoryWrite
} from "../fileSystemAccess";

const contentStatusOptions: ContentStatus[] = ["empty", "procedural", "authored"];
const reviewStatusOptions: ReviewStatus[] = ["empty", "needs review", "reviewed", "approved"];

function createCounts(items: string[]) {
  return [...items.reduce((counts, item) => counts.set(item, (counts.get(item) ?? 0) + 1), new Map<string, number>())]
    .sort((left, right) => right[1] - left[1]);
}

function createDownloadUrl(contents: string) {
  return URL.createObjectURL(
    new Blob([contents], {
      type: "application/json"
    })
  );
}

export function EdinburghReviewPage() {
  const [boardDraft, setBoardDraft] = useState(() => listEdinburghBoardDraft());
  const [selectedDistrictId, setSelectedDistrictId] = useState(boardDraft.districts[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState<LocalDirectoryHandle | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingToDirectory, setIsSavingToDirectory] = useState(false);

  const filteredDistricts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return boardDraft.districts;
    }

    return boardDraft.districts.filter((district) =>
      [
        district.square,
        district.name,
        district.locality,
        district.dayProfile,
        district.nightProfile,
        district.descriptors.join(" "),
        district.landmarks.join(" "),
        district.toneCues.join(" ")
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [boardDraft.districts, query]);

  const selectedDistrict =
    filteredDistricts.find((district) => district.id === selectedDistrictId) ??
    boardDraft.districts.find((district) => district.id === selectedDistrictId) ??
    filteredDistricts[0] ??
    boardDraft.districts[0] ??
    null;

  const localityCounts = useMemo(
    () => createCounts(boardDraft.districts.map((district) => district.locality)),
    [boardDraft.districts]
  );
  const reviewStatusCounts = useMemo(
    () => createCounts(boardDraft.districts.map((district) => district.reviewStatus)),
    [boardDraft.districts]
  );
  const hasLocalDraft = useMemo(
    () => JSON.stringify(boardDraft) !== JSON.stringify(edinburghBoard),
    [boardDraft]
  );
  const supportsDirectorySave = supportsDirectoryWrite();

  const applyBoardUpdate = (nextBoard: typeof boardDraft) => {
    setBoardDraft(saveEdinburghBoardDraft(nextBoard));
    setSaveError(null);
    setSaveMessage("Saved to local draft.");
  };

  const handleDownload = () => {
    const downloadUrl = createDownloadUrl(`${JSON.stringify(boardDraft, null, 2)}\n`);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "edinburgh-board.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 250);
    setSaveError(null);
    setSaveMessage("Downloaded edinburgh-board.json.");
  };

  const handleChooseDirectory = async () => {
    try {
      const nextDirectoryHandle = await pickLocalDirectory();
      setDirectoryHandle(nextDirectoryHandle);
      setSaveError(null);
      setSaveMessage(`Connected folder: ${nextDirectoryHandle.name}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not connect a local folder.");
      setSaveMessage(null);
    }
  };

  const handleSaveToDirectory = async () => {
    setIsSavingToDirectory(true);

    try {
      const activeDirectoryHandle = directoryHandle ?? (await pickLocalDirectory());
      const result = await saveEdinburghBoardToDirectory(activeDirectoryHandle, boardDraft);
      setDirectoryHandle(activeDirectoryHandle);
      setSaveError(null);
      setSaveMessage(
        `${result.mode === "updated" ? "Updated" : "Created"} ${result.displayPath}`
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save to the selected folder.");
      setSaveMessage(null);
    } finally {
      setIsSavingToDirectory(false);
    }
  };

  const handleResetToCheckedInData = () => {
    const nextBoard = resetEdinburghBoardDraft();
    setBoardDraft(nextBoard);
    setSelectedDistrictId(nextBoard.districts[0]?.id ?? "");
    setSaveError(null);
    setSaveMessage("Reset to checked-in Edinburgh data.");
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Edinburgh Review</Badge>
            <Badge variant="outline">{boardDraft.districts.length} mapped squares</Badge>
            {hasLocalDraft ? <Badge variant="outline">Local draft active</Badge> : null}
          </div>
          <CardTitle className="text-3xl tracking-tight">{boardDraft.name}</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6">
            Review the current city mapping, inspect district coverage, and edit the gathered
            material before saving it back into the repository or exporting a JSON snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            <Download data-icon="inline-start" />
            Download JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleChooseDirectory}>
            <FolderOpen data-icon="inline-start" />
            {directoryHandle ? "Reconnect Folder" : "Choose Folder"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveToDirectory}
            disabled={isSavingToDirectory}
          >
            <Save data-icon="inline-start" />
            {isSavingToDirectory ? "Saving…" : "Save to Directory"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleResetToCheckedInData}>
            <RefreshCcw data-icon="inline-start" />
            Reset to Checked-in Data
          </Button>
          <div className="min-w-0 text-sm text-muted-foreground">
            {supportsDirectorySave
              ? directoryHandle
                ? `Connected folder: ${directoryHandle.name}`
                : "Directory save is available on localhost in supported Chromium browsers."
              : "Directory save is not available in this browser; use Download JSON instead."}
          </div>
          {saveMessage ? <p className="text-sm text-muted-foreground">{saveMessage}</p> : null}
          {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="gap-3">
              <div className="flex items-center gap-2">
                <MapPinned className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle>Overview</CardTitle>
              </div>
              <CardDescription>{boardDraft.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Board Orientation
                  </p>
                  <p className="mt-2 text-sm">{boardDraft.boardOrientation}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Review Status
                  </p>
                  <p className="mt-2 text-sm">{boardDraft.reviewStatus}</p>
                </div>
              </div>

              <div className="grid gap-3">
                <p className="text-sm font-semibold">Source URLs</p>
                <div className="grid gap-2">
                  {boardDraft.sourceUrls.map((sourceUrl) => (
                    <a
                      key={sourceUrl}
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {sourceUrl}
                    </a>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid gap-3">
                <p className="text-sm font-semibold">Localities</p>
                <div className="flex flex-wrap gap-2">
                  {localityCounts.map(([locality, count]) => (
                    <Badge key={locality} variant="secondary">
                      {locality}: {count}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <p className="text-sm font-semibold">District Review Status</p>
                <div className="flex flex-wrap gap-2">
                  {reviewStatusCounts.map(([status, count]) => (
                    <Badge key={status} variant="outline">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle>Districts</CardTitle>
              </div>
              <CardDescription>Search and select a square to inspect or edit its notes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Search
                </span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    name="district-search"
                    value={query}
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search square, district, locality, or note…"
                    className="pl-8"
                  />
                </div>
              </label>

              <ScrollArea className="h-[36rem] rounded-lg border">
                <div className="grid gap-2 p-2">
                  {filteredDistricts.map((district) => (
                    <button
                      key={district.id}
                      type="button"
                      className={cn(
                        "grid gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selectedDistrict?.id === district.id ? "bg-muted" : "bg-background"
                      )}
                      onClick={() => setSelectedDistrictId(district.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{district.name}</p>
                          <p className="text-sm text-muted-foreground">{district.locality}</p>
                        </div>
                        <Badge variant="outline">{district.square}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {district.descriptors.slice(0, 3).map((descriptor) => (
                          <Badge key={`${district.id}-${descriptor}`} variant="secondary">
                            {descriptor}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                  {!filteredDistricts.length ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No districts match that filter.
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader className="gap-3">
              <CardTitle>City Metadata</CardTitle>
              <CardDescription>
                These fields describe the board-wide Edinburgh mapping and review provenance.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium">Summary</span>
                <Textarea
                  name="edinburgh-summary"
                  value={boardDraft.summary}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(boardDraft, "summary", event.currentTarget.value)
                    )
                  }
                  rows={4}
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium">Board orientation</span>
                <Textarea
                  name="edinburgh-board-orientation"
                  value={boardDraft.boardOrientation}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "boardOrientation",
                        event.currentTarget.value
                      )
                    )
                  }
                  rows={3}
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium">Source URLs</span>
                <Textarea
                  name="edinburgh-source-urls"
                  value={formatMultilineList(boardDraft.sourceUrls)}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "sourceUrls",
                        parseMultilineList(event.currentTarget.value)
                      )
                    )
                  }
                  rows={5}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Generation source</span>
                <Input
                  name="edinburgh-generation-source"
                  value={boardDraft.generationSource}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "generationSource",
                        event.currentTarget.value
                      )
                    )
                  }
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Last reviewed</span>
                <Input
                  name="edinburgh-last-reviewed-at"
                  value={boardDraft.lastReviewedAt ?? ""}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "lastReviewedAt",
                        event.currentTarget.value || null
                      )
                    )
                  }
                  placeholder="YYYY-MM-DD…"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Content status</span>
                <select
                  className="field-select"
                  value={boardDraft.contentStatus}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "contentStatus",
                        event.currentTarget.value as ContentStatus
                      )
                    )
                  }
                >
                  {contentStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Review status</span>
                <select
                  className="field-select"
                  value={boardDraft.reviewStatus}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "reviewStatus",
                        event.currentTarget.value as ReviewStatus
                      )
                    )
                  }
                >
                  {reviewStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium">Review notes</span>
                <Textarea
                  name="edinburgh-review-notes"
                  value={boardDraft.reviewNotes ?? ""}
                  onChange={(event) =>
                    applyBoardUpdate(
                      updateEdinburghBoardMeta(
                        boardDraft,
                        "reviewNotes",
                        event.currentTarget.value || null
                      )
                    )
                  }
                  rows={4}
                />
              </label>
            </CardContent>
          </Card>

          {selectedDistrict ? (
            <Card>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{selectedDistrict.square}</Badge>
                  <Badge variant="outline">{selectedDistrict.locality}</Badge>
                </div>
                <CardTitle>{selectedDistrict.name}</CardTitle>
                <CardDescription>
                  Edit the gathered district detail for this mapped square.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium">District name</span>
                  <Input
                    name={`district-name-${selectedDistrict.id}`}
                    value={selectedDistrict.name}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "name",
                          event.currentTarget.value
                        )
                      )
                    }
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Locality</span>
                  <Input
                    name={`district-locality-${selectedDistrict.id}`}
                    value={selectedDistrict.locality}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "locality",
                          event.currentTarget.value
                        )
                      )
                    }
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Descriptors</span>
                  <Textarea
                    name={`district-descriptors-${selectedDistrict.id}`}
                    value={formatMultilineList(selectedDistrict.descriptors)}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "descriptors",
                          parseMultilineList(event.currentTarget.value)
                        )
                      )
                    }
                    rows={4}
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Landmarks</span>
                  <Textarea
                    name={`district-landmarks-${selectedDistrict.id}`}
                    value={formatMultilineList(selectedDistrict.landmarks)}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "landmarks",
                          parseMultilineList(event.currentTarget.value)
                        )
                      )
                    }
                    rows={4}
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Day profile</span>
                  <Textarea
                    name={`district-day-profile-${selectedDistrict.id}`}
                    value={selectedDistrict.dayProfile}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "dayProfile",
                          event.currentTarget.value
                        )
                      )
                    }
                    rows={3}
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Night profile</span>
                  <Textarea
                    name={`district-night-profile-${selectedDistrict.id}`}
                    value={selectedDistrict.nightProfile}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "nightProfile",
                          event.currentTarget.value
                        )
                      )
                    }
                    rows={3}
                  />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Tone cues</span>
                  <Textarea
                    name={`district-tone-cues-${selectedDistrict.id}`}
                    value={formatMultilineList(selectedDistrict.toneCues)}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "toneCues",
                          parseMultilineList(event.currentTarget.value)
                        )
                      )
                    }
                    rows={4}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Content status</span>
                  <select
                    className="field-select"
                    value={selectedDistrict.contentStatus}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "contentStatus",
                          event.currentTarget.value as ContentStatus
                        )
                      )
                    }
                  >
                    {contentStatusOptions.map((status) => (
                      <option key={`${selectedDistrict.id}-${status}`} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Review status</span>
                  <select
                    className="field-select"
                    value={selectedDistrict.reviewStatus}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "reviewStatus",
                          event.currentTarget.value as ReviewStatus
                        )
                      )
                    }
                  >
                    {reviewStatusOptions.map((status) => (
                      <option key={`${selectedDistrict.id}-review-${status}`} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Last reviewed</span>
                  <Input
                    name={`district-last-reviewed-${selectedDistrict.id}`}
                    value={selectedDistrict.lastReviewedAt ?? ""}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "lastReviewedAt",
                          event.currentTarget.value || null
                        )
                      )
                    }
                    placeholder="YYYY-MM-DD…"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Square</span>
                  <Input name={`district-square-${selectedDistrict.id}`} value={selectedDistrict.square} disabled />
                </label>

                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-medium">Review notes</span>
                  <Textarea
                    name={`district-review-notes-${selectedDistrict.id}`}
                    value={selectedDistrict.reviewNotes ?? ""}
                    onChange={(event) =>
                      applyBoardUpdate(
                        updateEdinburghDistrictField(
                          boardDraft,
                          selectedDistrict.id,
                          "reviewNotes",
                          event.currentTarget.value || null
                        )
                      )
                    }
                    rows={4}
                  />
                </label>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
