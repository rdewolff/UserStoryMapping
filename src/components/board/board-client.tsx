"use client";

import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";

import { applyMoveByIds, positionUpdates } from "@/lib/board-move";
import {
  EFFORT_LEVELS,
  LANE_LABELS,
  PRIORITY_LANES,
  type EffortLevel,
  type PriorityLane,
} from "@/lib/constants";
import {
  normalizeEffort,
  normalizeLane,
  normalizeWeekTarget,
  parseCsv,
} from "@/lib/csv";
import type { BoardDto, CardDto, ModuleDto } from "@/lib/serializers";

type BoardClientProps = {
  initialBoard: BoardDto;
  initialModules: ModuleDto[];
  initialCards: CardDto[];
  userEmail: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type LaneFilter = PriorityLane | "all";
type EffortFilter = EffortLevel | "all";
type ModuleFilter = string | "all";

type DetailDraft = {
  title: string;
  description: string;
  effort: EffortLevel;
  weekTarget: string;
};

type CsvColumnKey =
  | "module"
  | "title"
  | "description"
  | "priorityLane"
  | "effort"
  | "weekTarget";

type CsvColumnMapping = Record<CsvColumnKey, string>;

const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;
const CSV_NONE = "__none__";

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function detectHeader(headers: string[], aliases: string[]): string {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  const match = headers.find((header) => aliasSet.has(normalizeHeader(header)));
  return match ?? CSV_NONE;
}

function buildInitialCsvMapping(headers: string[]): CsvColumnMapping {
  const titleHeader = detectHeader(headers, ["title", "story", "task", "name"]);

  return {
    module: detectHeader(headers, ["module", "feature", "epic", "column"]),
    title: titleHeader !== CSV_NONE ? titleHeader : headers[0] ?? CSV_NONE,
    description: detectHeader(headers, ["description", "details", "notes"]),
    priorityLane: detectHeader(headers, ["lane", "priority", "slice"]),
    effort: detectHeader(headers, ["effort", "size", "complexity"]),
    weekTarget: detectHeader(headers, ["week", "target week", "sprint", "week target"]),
  };
}

function containerId(moduleId: string, lane: PriorityLane): string {
  return `container:${moduleId}:${lane}`;
}

function parseContainerId(rawId: string): { moduleId: string; lane: PriorityLane } | null {
  if (!rawId.startsWith("container:")) {
    return null;
  }

  const [, moduleId, lane] = rawId.split(":");

  if (!moduleId || !lane || !PRIORITY_LANES.includes(lane as PriorityLane)) {
    return null;
  }

  return {
    moduleId,
    lane: lane as PriorityLane,
  };
}

function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

function cardMatchesFilters(
  card: CardDto,
  search: string,
  laneFilter: LaneFilter,
  effortFilter: EffortFilter,
  moduleFilter: ModuleFilter,
): boolean {
  if (laneFilter !== "all" && card.priorityLane !== laneFilter) {
    return false;
  }

  if (effortFilter !== "all" && card.effort !== effortFilter) {
    return false;
  }

  if (moduleFilter !== "all" && card.moduleId !== moduleFilter) {
    return false;
  }

  const term = search.trim().toLowerCase();
  if (!term) {
    return true;
  }

  return (
    card.title.toLowerCase().includes(term) ||
    (card.description ?? "").toLowerCase().includes(term)
  );
}

function filterCards(
  cards: CardDto[],
  search: string,
  laneFilter: LaneFilter,
  effortFilter: EffortFilter,
  moduleFilter: ModuleFilter,
): CardDto[] {
  return cards.filter((card) =>
    cardMatchesFilters(card, search, laneFilter, effortFilter, moduleFilter),
  );
}

function sanitizeWeekTarget(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function createDraft(card: CardDto): DetailDraft {
  return {
    title: card.title,
    description: card.description ?? "",
    effort: card.effort,
    weekTarget: card.weekTarget ?? "",
  };
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return <span className="status-chip status-saving">Saving...</span>;
  }

  if (state === "saved") {
    return <span className="status-chip status-saved">Saved</span>;
  }

  if (state === "error") {
    return <span className="status-chip status-error">Save error</span>;
  }

  return <span className="status-chip">Ready</span>;
}

function LaneDropZone({
  laneId,
  moduleId,
  lane,
  children,
  disabled,
}: {
  laneId: string;
  moduleId: string;
  lane: PriorityLane;
  children: React.ReactNode;
  disabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: laneId,
    data: {
      type: "container",
      moduleId,
      lane,
    },
    disabled,
  });

  return (
    <div
      className={`lane-drop-zone ${isOver ? "lane-drop-zone--over" : ""}`}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
}

function CardItem({
  card,
  selected,
  disabled,
  onSelect,
  isEditing,
  editingTitle,
  onDoubleEdit,
  onEditingTitleChange,
  onEditingSubmit,
  onEditingCancel,
}: {
  card: CardDto;
  selected: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  isEditing: boolean;
  editingTitle: string;
  onDoubleEdit: (card: CardDto) => void;
  onEditingTitleChange: (value: string) => void;
  onEditingSubmit: () => void;
  onEditingCancel: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      disabled,
      data: {
        type: "card",
        moduleId: card.moduleId,
        lane: card.priorityLane,
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <article
      className={`story-card ${selected ? "story-card--selected" : ""}`}
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(card.id)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDoubleEdit(card);
      }}
      tabIndex={0}
      role="button"
    >
      <div className="story-card-head">
        {isEditing ? (
          <input
            autoFocus
            className="inline-title-input"
            onBlur={onEditingSubmit}
            onChange={(event) => onEditingTitleChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onEditingSubmit();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onEditingCancel();
              }
            }}
            value={editingTitle}
          />
        ) : (
          <p className="text-sm font-medium leading-snug text-[var(--text)]">{card.title}</p>
        )}
        <button
          aria-label={`Drag ${card.title}`}
          className="drag-handle"
          onClick={(event) => event.stopPropagation()}
          type="button"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
        <span className="meta-chip">{card.effort.toUpperCase()}</span>
        {card.weekTarget ? <span className="meta-chip">{card.weekTarget}</span> : null}
      </div>
    </article>
  );
}

function OverlayCard({ card }: { card: CardDto }) {
  return (
    <article className="story-card story-card--overlay">
      <p className="text-sm font-medium leading-snug text-[var(--text)]">{card.title}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
        <span className="meta-chip">{card.effort.toUpperCase()}</span>
        {card.weekTarget ? <span className="meta-chip">{card.weekTarget}</span> : null}
      </div>
    </article>
  );
}

export function BoardClient({
  initialBoard,
  initialModules,
  initialCards,
  userEmail,
}: BoardClientProps) {
  const [board, setBoard] = useState(initialBoard);
  const [boardNameDraft, setBoardNameDraft] = useState(initialBoard.name);
  const [modules, setModules] = useState(sortByPosition(initialModules));
  const [cards, setCards] = useState(initialCards);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState<LaneFilter>("all");
  const [effortFilter, setEffortFilter] = useState<EffortFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [moduleNameDraft, setModuleNameDraft] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([]);
  const [csvHasHeaders, setCsvHasHeaders] = useState(true);
  const [csvMapping, setCsvMapping] = useState<CsvColumnMapping>({
    module: CSV_NONE,
    title: CSV_NONE,
    description: CSV_NONE,
    priorityLane: CSV_NONE,
    effort: CSV_NONE,
    weekTarget: CSV_NONE,
  });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragSnapshotRef = useRef<CardDto[] | null>(null);
  const panStateRef = useRef<{
    isPanning: boolean;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const saveIndicatorTimerRef = useRef<number | null>(null);

  const hasActiveFilters =
    search.trim().length > 0 ||
    laneFilter !== "all" ||
    effortFilter !== "all" ||
    moduleFilter !== "all";

  const canDrag = !hasActiveFilters && editingCardId === null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  const visibleCards = useMemo(
    () => filterCards(cards, search, laneFilter, effortFilter, moduleFilter),
    [cards, search, laneFilter, effortFilter, moduleFilter],
  );

  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeCardId) ?? null,
    [activeCardId, cards],
  );

  const csvHeaders = useMemo(() => {
    if (csvRawRows.length === 0) {
      return [] as string[];
    }

    if (csvHasHeaders) {
      return csvRawRows[0].map((value, index) =>
        value.trim() || `column_${index + 1}`,
      );
    }

    const longestRow = csvRawRows.reduce(
      (max, row) => Math.max(max, row.length),
      0,
    );
    return Array.from({ length: longestRow }, (_, index) => `column_${index + 1}`);
  }, [csvRawRows, csvHasHeaders]);

  const csvDataRows = useMemo(() => {
    if (csvRawRows.length === 0) {
      return [] as string[][];
    }

    return csvHasHeaders ? csvRawRows.slice(1) : csvRawRows;
  }, [csvRawRows, csvHasHeaders]);

  const csvHeaderIndex = useMemo(
    () => new Map(csvHeaders.map((header, index) => [header, index])),
    [csvHeaders],
  );

  useEffect(() => {
    if (!selectedCard) {
      setDetailDraft(null);
      return;
    }

    setDetailDraft(createDraft(selectedCard));
  }, [selectedCard]);

  useEffect(() => {
    if (csvHeaders.length === 0) {
      return;
    }

    const defaults = buildInitialCsvMapping(csvHeaders);

    setCsvMapping((previous) => {
      const next = { ...previous };

      (Object.keys(defaults) as CsvColumnKey[]).forEach((key) => {
        const existing = previous[key];
        if (existing !== CSV_NONE && csvHeaders.includes(existing)) {
          next[key] = existing;
          return;
        }
        next[key] = defaults[key];
      });

      return next;
    });
  }, [csvHeaders]);

  useEffect(() => {
    if (!editingCardId) {
      return;
    }

    const stillExists = cards.some((card) => card.id === editingCardId);
    if (!stillExists) {
      cancelInlineCardEdit();
    }
  }, [cards, editingCardId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !event.repeat) {
        setIsSpacePressed(true);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  function markSaving() {
    if (saveIndicatorTimerRef.current) {
      window.clearTimeout(saveIndicatorTimerRef.current);
      saveIndicatorTimerRef.current = null;
    }
    setSaveState("saving");
  }

  function markSaved() {
    setSaveState("saved");
    if (saveIndicatorTimerRef.current) {
      window.clearTimeout(saveIndicatorTimerRef.current);
    }

    saveIndicatorTimerRef.current = window.setTimeout(() => {
      setSaveState("idle");
      saveIndicatorTimerRef.current = null;
    }, 1200);
  }

  function markError(message: string) {
    setSaveState("error");
    setErrorMessage(message);
  }

  function setCardsFromServer(updates: CardDto[]) {
    setCards((previous) => {
      const next = [...previous];
      const byId = new Map(next.map((card, index) => [card.id, index]));

      for (const update of updates) {
        const index = byId.get(update.id);
        if (index === undefined) {
          next.push(update);
        } else {
          next[index] = update;
        }
      }

      return next;
    });
  }

  function cardsInLane(moduleId: string, lane: PriorityLane, source: CardDto[] = cards): CardDto[] {
    return sortByPosition(
      source.filter((card) => card.moduleId === moduleId && card.priorityLane === lane),
    );
  }

  function getCsvCellValue(row: string[], mappedColumn: string): string {
    if (mappedColumn === CSV_NONE) {
      return "";
    }

    const index = csvHeaderIndex.get(mappedColumn);
    if (index === undefined) {
      return "";
    }

    return row[index]?.trim() ?? "";
  }

  async function refreshBoardSnapshot() {
    const response = await fetch(`/api/boards/${board.id}`, {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Could not refresh board");
    }

    const payload = (await response.json()) as {
      board: BoardDto;
      modules: ModuleDto[];
      cards: CardDto[];
    };

    setBoard(payload.board);
    setBoardNameDraft(payload.board.name);
    setModules(sortByPosition(payload.modules));
    setCards(payload.cards);
  }

  async function onCsvFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const rows = parseCsv(text);
      setCsvRawRows(rows);
      setCsvFileName(file.name);
      setErrorMessage(null);
    } catch {
      markError("Could not parse CSV file");
    } finally {
      event.target.value = "";
    }
  }

  async function importFromCsv() {
    if (csvDataRows.length === 0) {
      markError("No CSV rows to import");
      return;
    }

    if (csvMapping.title === CSV_NONE) {
      markError("Please map a title column before importing");
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    markSaving();

    try {
      const moduleByName = new Map(
        modules.map((moduleRecord) => [
          moduleRecord.name.trim().toLowerCase(),
          moduleRecord.id,
        ]),
      );

      for (const row of csvDataRows) {
        const title = getCsvCellValue(row, csvMapping.title);
        if (!title) {
          continue;
        }

        const moduleNameRaw = getCsvCellValue(row, csvMapping.module);
        const moduleName = moduleNameRaw || "General";
        const moduleKey = moduleName.trim().toLowerCase();

        let moduleId = moduleByName.get(moduleKey);

        if (!moduleId) {
          const moduleResponse = await fetch(`/api/boards/${board.id}/modules`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: moduleName,
            }),
          });

          if (!moduleResponse.ok) {
            const payload = (await moduleResponse.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(payload?.error ?? "Could not create module during import");
          }

          const modulePayload = (await moduleResponse.json()) as { module: ModuleDto };
          moduleId = modulePayload.module.id;
          moduleByName.set(moduleKey, moduleId);
          setModules((previous) => sortByPosition([...previous, modulePayload.module]));
        }

        const lane = normalizeLane(getCsvCellValue(row, csvMapping.priorityLane));
        const effort = normalizeEffort(getCsvCellValue(row, csvMapping.effort));
        const description = getCsvCellValue(row, csvMapping.description) || null;
        const weekTarget = normalizeWeekTarget(getCsvCellValue(row, csvMapping.weekTarget));

        const cardResponse = await fetch(`/api/boards/${board.id}/cards`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            moduleId,
            title,
            description,
            priorityLane: lane,
            effort,
            weekTarget,
          }),
        });

        if (!cardResponse.ok) {
          const payload = (await cardResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? "Could not create card during import");
        }
      }

      await refreshBoardSnapshot();
      markSaved();
    } catch (importError) {
      markError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  async function createModule() {
    const nextName = moduleNameDraft.trim();
    if (!nextName) {
      return;
    }

    setErrorMessage(null);
    markSaving();

    try {
      const response = await fetch(`/api/boards/${board.id}/modules`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not create module");
      }

      const payload = (await response.json()) as { module: ModuleDto };
      setModules((previous) => sortByPosition([...previous, payload.module]));
      setModuleNameDraft("");
      markSaved();
    } catch (createError) {
      markError(createError instanceof Error ? createError.message : "Could not create module");
    }
  }

  async function renameModule(moduleId: string, name: string) {
    const moduleRecord = modules.find((entry) => entry.id === moduleId);
    if (!moduleRecord) {
      return;
    }

    const nextName = name.trim();
    if (!nextName || nextName === moduleRecord.name) {
      return;
    }

    const previous = moduleRecord;

    setModules((previousModules) =>
      previousModules.map((entry) =>
        entry.id === moduleId
          ? {
              ...entry,
              name: nextName,
            }
          : entry,
      ),
    );

    markSaving();

    try {
      const response = await fetch(`/api/modules/${moduleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
          version: moduleRecord.version,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not rename module");
      }

      const payload = (await response.json()) as { module: ModuleDto };
      setModules((previousModules) =>
        sortByPosition(
          previousModules.map((entry) =>
            entry.id === moduleId ? payload.module : entry,
          ),
        ),
      );
      markSaved();
    } catch (renameError) {
      setModules((previousModules) =>
        previousModules.map((entry) =>
          entry.id === moduleId ? previous : entry,
        ),
      );
      markError(renameError instanceof Error ? renameError.message : "Could not rename module");
    }
  }

  async function deleteModule(moduleId: string) {
    const confirmed = window.confirm(
      "Delete this module and all cards inside it? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    const previousModules = modules;
    const previousCards = cards;

    setModules((existing) => existing.filter((module) => module.id !== moduleId));
    setCards((existing) => existing.filter((card) => card.moduleId !== moduleId));

    if (selectedCardId) {
      const selected = cards.find((card) => card.id === selectedCardId);
      if (selected?.moduleId === moduleId) {
        setSelectedCardId(null);
      }
    }

    markSaving();

    try {
      const response = await fetch(`/api/modules/${moduleId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not delete module");
      }

      markSaved();
    } catch (deleteError) {
      setModules(previousModules);
      setCards(previousCards);
      markError(deleteError instanceof Error ? deleteError.message : "Could not delete module");
    }
  }

  async function createCard(moduleId: string, lane: PriorityLane) {
    const fallbackTitle = `New ${LANE_LABELS[lane]} story`;

    markSaving();
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/boards/${board.id}/cards`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moduleId,
          priorityLane: lane,
          title: fallbackTitle,
          effort: "m",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not create card");
      }

      const payload = (await response.json()) as { card: CardDto };

      setCards((previous) => [...previous, payload.card]);
      setSelectedCardId(payload.card.id);
      markSaved();
    } catch (createError) {
      markError(createError instanceof Error ? createError.message : "Could not create card");
    }
  }

  async function updateCard(cardId: string, patch: Partial<CardDto>): Promise<boolean> {
    const existing = cards.find((card) => card.id === cardId);
    if (!existing) {
      return false;
    }

    const optimistic: CardDto = {
      ...existing,
      ...patch,
    };

    setCards((previous) =>
      previous.map((card) => (card.id === cardId ? optimistic : card)),
    );

    markSaving();

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: optimistic.title,
          description: optimistic.description,
          effort: optimistic.effort,
          weekTarget: optimistic.weekTarget,
          version: existing.version,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not update card");
      }

      const payload = (await response.json()) as { card: CardDto };
      setCardsFromServer([payload.card]);
      markSaved();
      return true;
    } catch (updateError) {
      setCards((previous) =>
        previous.map((card) => (card.id === cardId ? existing : card)),
      );
      markError(updateError instanceof Error ? updateError.message : "Could not update card");
      return false;
    }
  }

  async function saveDetailDraft() {
    if (!selectedCard || !detailDraft) {
      return;
    }

    const patch: Partial<CardDto> = {
      title: detailDraft.title.trim() || selectedCard.title,
      description: detailDraft.description.trim() || null,
      effort: detailDraft.effort,
      weekTarget: sanitizeWeekTarget(detailDraft.weekTarget),
    };

    await updateCard(selectedCard.id, patch);
  }

  function startInlineCardEdit(card: CardDto) {
    setSelectedCardId(card.id);
    setEditingCardId(card.id);
    setEditingCardTitle(card.title);
  }

  function cancelInlineCardEdit() {
    setEditingCardId(null);
    setEditingCardTitle("");
  }

  async function submitInlineCardEdit(cardId: string) {
    const title = editingCardTitle.trim();
    if (!title) {
      markError("Card title cannot be empty");
      return;
    }

    const existing = cards.find((card) => card.id === cardId);
    if (!existing) {
      cancelInlineCardEdit();
      return;
    }

    if (existing.title === title) {
      cancelInlineCardEdit();
      return;
    }

    const wasUpdated = await updateCard(cardId, { title });
    if (wasUpdated) {
      cancelInlineCardEdit();
    }
  }

  async function deleteCard(cardId: string) {
    const confirmed = window.confirm("Delete this card?");
    if (!confirmed) {
      return;
    }

    const previousCards = cards;

    setCards((previous) => previous.filter((card) => card.id !== cardId));
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    }
    if (editingCardId === cardId) {
      cancelInlineCardEdit();
    }

    markSaving();

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not delete card");
      }

      markSaved();
    } catch (deleteError) {
      setCards(previousCards);
      markError(deleteError instanceof Error ? deleteError.message : "Could not delete card");
    }
  }

  async function updateBoardName() {
    const nextName = boardNameDraft.trim();
    if (!nextName || nextName === board.name) {
      return;
    }

    const previous = board;

    setBoard((existing) => ({
      ...existing,
      name: nextName,
    }));

    markSaving();

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
          version: board.version,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not rename board");
      }

      const payload = (await response.json()) as { board: BoardDto };
      setBoard(payload.board);
      setBoardNameDraft(payload.board.name);
      markSaved();
    } catch (renameError) {
      setBoard(previous);
      setBoardNameDraft(previous.name);
      markError(renameError instanceof Error ? renameError.message : "Could not rename board");
    }
  }

  function onDragStart(event: DragStartEvent) {
    if (!canDrag) {
      return;
    }

    const cardId = String(event.active.id);
    const existing = cards.find((card) => card.id === cardId);

    if (!existing) {
      return;
    }

    dragSnapshotRef.current = cards;
    setActiveCardId(existing.id);
    setErrorMessage(null);
  }

  function onDragCancel() {
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    setActiveCardId(null);

    if (snapshot) {
      setCards(snapshot);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const snapshot = dragSnapshotRef.current;
    dragSnapshotRef.current = null;

    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;

    setActiveCardId(null);

    if (!snapshot || !overId) {
      setCards(snapshot ?? cards);
      return;
    }

    const activeCard = snapshot.find((card) => card.id === activeId);
    if (!activeCard) {
      setCards(snapshot);
      return;
    }

    const source = {
      moduleId: activeCard.moduleId,
      lane: activeCard.priorityLane,
    };

    let target: { moduleId: string; lane: PriorityLane } | null = parseContainerId(overId);

    if (!target) {
      const overCard = snapshot.find((card) => card.id === overId);
      if (overCard) {
        target = {
          moduleId: overCard.moduleId,
          lane: overCard.priorityLane,
        };
      }
    }

    if (!target) {
      setCards(snapshot);
      return;
    }

    const sourceIds = cardsInLane(source.moduleId, source.lane, snapshot).map((card) => card.id);
    const targetIds = cardsInLane(target.moduleId, target.lane, snapshot).map((card) => card.id);

    let targetIndex = targetIds.length;

    if (!overId.startsWith("container:")) {
      const overIndex = targetIds.indexOf(overId);
      if (overIndex >= 0) {
        targetIndex = overIndex;

        const pointerTop = event.active.rect.current.translated?.top;
        if (pointerTop !== undefined && event.over) {
          const middleY = event.over.rect.top + event.over.rect.height / 2;
          if (pointerTop > middleY) {
            targetIndex += 1;
          }
        }
      }
    }

    const moveResult = applyMoveByIds({
      sourceIds,
      targetIds,
      cardId: activeCard.id,
      targetIndex,
      sourceContainer: `${source.moduleId}::${source.lane}`,
      targetContainer: `${target.moduleId}::${target.lane}`,
    });

    const sourceUpdates = positionUpdates(moveResult.sourceIds);
    const targetUpdates = positionUpdates(moveResult.targetIds);

    const sameContainer =
      source.moduleId === target.moduleId && source.lane === target.lane;

    const optimisticCards = snapshot.map((card) => ({ ...card }));
    const byId = new Map(optimisticCards.map((card) => [card.id, card]));

    if (sameContainer) {
      for (const update of targetUpdates) {
        const card = byId.get(update.id);
        if (!card) {
          continue;
        }
        card.moduleId = target.moduleId;
        card.priorityLane = target.lane;
        card.position = update.position;
      }
    } else {
      for (const update of sourceUpdates) {
        const card = byId.get(update.id);
        if (!card) {
          continue;
        }
        card.moduleId = source.moduleId;
        card.priorityLane = source.lane;
        card.position = update.position;
      }

      for (const update of targetUpdates) {
        const card = byId.get(update.id);
        if (!card) {
          continue;
        }
        card.moduleId = target.moduleId;
        card.priorityLane = target.lane;
        card.position = update.position;
      }
    }

    setCards(optimisticCards);
    markSaving();

    try {
      const response = await fetch(`/api/cards/${activeCard.id}/move`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetModuleId: target.moduleId,
          targetLane: target.lane,
          targetPosition: targetIndex,
          version: activeCard.version,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not move card");
      }

      const payload = (await response.json()) as { cards: CardDto[] };
      setCardsFromServer(payload.cards);
      markSaved();
    } catch (moveError) {
      setCards(snapshot);
      markError(moveError instanceof Error ? moveError.message : "Could not move card");
    }
  }

  function onViewportMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!isSpacePressed || !viewportRef.current) {
      return;
    }

    event.preventDefault();

    panStateRef.current = {
      isPanning: true,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewportRef.current.scrollLeft,
      startScrollTop: viewportRef.current.scrollTop,
    };
  }

  function onViewportMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!panStateRef.current?.isPanning || !viewportRef.current) {
      return;
    }

    const deltaX = event.clientX - panStateRef.current.startX;
    const deltaY = event.clientY - panStateRef.current.startY;

    viewportRef.current.scrollLeft = panStateRef.current.startScrollLeft - deltaX;
    viewportRef.current.scrollTop = panStateRef.current.startScrollTop - deltaY;
  }

  function stopPanning() {
    if (!panStateRef.current) {
      return;
    }

    panStateRef.current.isPanning = false;
  }

  return (
    <main className="board-shell">
      <header className="board-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          <Link className="secondary-btn" href="/boards">
            Back
          </Link>
          <div className="min-w-[220px]">
            <input
              className="board-title-input"
              onBlur={updateBoardName}
              onChange={(event) => setBoardNameDraft(event.target.value)}
              value={boardNameDraft}
            />
            <p className="mt-1 text-xs text-[var(--text-soft)]">{userEmail}</p>
          </div>
        </div>

        <div className="toolbar-controls">
          <SaveIndicator state={saveState} />
          <input
            className="input input-compact"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            value={search}
          />
          <select
            className="input input-compact"
            onChange={(event) => setLaneFilter(event.target.value as LaneFilter)}
            value={laneFilter}
          >
            <option value="all">All lanes</option>
            {PRIORITY_LANES.map((lane) => (
              <option key={lane} value={lane}>
                {LANE_LABELS[lane]}
              </option>
            ))}
          </select>
          <select
            className="input input-compact"
            onChange={(event) => setEffortFilter(event.target.value as EffortFilter)}
            value={effortFilter}
          >
            <option value="all">All effort</option>
            {EFFORT_LEVELS.map((effort) => (
              <option key={effort} value={effort}>
                {effort.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            className="input input-compact"
            onChange={(event) => setModuleFilter(event.target.value as ModuleFilter)}
            value={moduleFilter}
          >
            <option value="all">All modules</option>
            {modules.map((featureModule) => (
              <option key={featureModule.id} value={featureModule.id}>
                {featureModule.name}
              </option>
            ))}
          </select>
          <div className="zoom-controls">
            <button className="secondary-btn" onClick={() => setZoom(1)} type="button">
              Fit
            </button>
            <button
              className="secondary-btn"
              onClick={() => setZoom((current) => Math.max(ZOOM_MIN, current - ZOOM_STEP))}
              type="button"
            >
              -
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              className="secondary-btn"
              onClick={() => setZoom((current) => Math.min(ZOOM_MAX, current + ZOOM_STEP))}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      </header>

      {errorMessage ? <div className="board-error">{errorMessage}</div> : null}

      <div className="board-utility-bar">
        <div className="utility-row">
          <form
            className="flex items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createModule();
            }}
          >
            <input
              className="input input-compact min-w-[220px]"
              onChange={(event) => setModuleNameDraft(event.target.value)}
              placeholder="New module name"
              value={moduleNameDraft}
            />
            <button className="primary-btn" type="submit">
              Add module
            </button>
          </form>

          <button
            className="secondary-btn"
            onClick={() => setIsImportOpen((current) => !current)}
            type="button"
          >
            {isImportOpen ? "Close CSV Import" : "Import CSV"}
          </button>
        </div>

        <div className="utility-row">
          {editingCardId ? (
            <p className="text-xs text-[var(--text-soft)]">
              Drag and drop is paused while inline editing is active.
            </p>
          ) : hasActiveFilters ? (
            <p className="text-xs text-[var(--text-soft)]">
              Drag and drop is disabled while filters are active.
            </p>
          ) : (
            <p className="text-xs text-[var(--text-soft)]">
              Tip: hold Space and drag to pan. Drag cards to reprioritize.
            </p>
          )}
          <p className="text-xs text-[var(--text-soft)]">
            Tip: double-click a card title to edit inline.
          </p>
        </div>

        {isImportOpen ? (
          <div className="csv-import-panel">
            <div className="csv-import-top">
              <label className="csv-file-input">
                <span>Upload CSV</span>
                <input accept=".csv,text/csv" onChange={onCsvFileSelected} type="file" />
              </label>
              <label className="csv-header-toggle">
                <input
                  checked={csvHasHeaders}
                  onChange={(event) => setCsvHasHeaders(event.target.checked)}
                  type="checkbox"
                />
                First row contains headers
              </label>
              <button
                className="primary-btn"
                disabled={isImporting || csvDataRows.length === 0 || csvMapping.title === CSV_NONE}
                onClick={() => {
                  void importFromCsv();
                }}
                type="button"
              >
                {isImporting ? "Importing..." : "Import rows"}
              </button>
            </div>

            <div className="csv-meta-row">
              <span>{csvFileName ?? "No file selected"}</span>
              <span>{csvDataRows.length} rows detected</span>
            </div>

            <div className="csv-mapping-grid">
              {(
                [
                  ["title", "Title (required)"],
                  ["module", "Module / Feature"],
                  ["description", "Description"],
                  ["priorityLane", "Priority lane"],
                  ["effort", "Effort"],
                  ["weekTarget", "Target week"],
                ] as const
              ).map(([key, label]) => (
                <label className="csv-map-field" key={key}>
                  <span>{label}</span>
                  <select
                    className="input input-compact"
                    onChange={(event) =>
                      setCsvMapping((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                    value={csvMapping[key]}
                  >
                    <option value={CSV_NONE}>Not mapped</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {csvDataRows.length > 0 && csvHeaders.length > 0 ? (
              <div className="csv-preview">
                <p className="csv-preview-title">Preview</p>
                <div className="csv-preview-table-wrap">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        {csvHeaders.map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvDataRows.slice(0, 3).map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {csvHeaders.map((header, headerIndex) => (
                            <td key={`${rowIndex}-${header}`}>
                              {row[headerIndex] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`board-viewport ${isSpacePressed ? "board-viewport--pannable" : ""}`}
        onMouseDown={onViewportMouseDown}
        onMouseMove={onViewportMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        ref={viewportRef}
      >
        <DndContext
          collisionDetection={closestCorners}
          onDragCancel={onDragCancel}
          onDragEnd={(event) => {
            void onDragEnd(event);
          }}
          onDragStart={onDragStart}
          sensors={sensors}
        >
          <div
            className="board-canvas"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: Math.max(1200, modules.length * 340),
            }}
          >
            {modules.length === 0 ? (
              <div className="empty-state max-w-2xl">
                Add your first module to start mapping stories.
              </div>
            ) : (
              modules.map((featureModule) => (
                <section className="module-column" key={featureModule.id}>
                  <header className="module-header">
                    <input
                      className="module-name-input"
                      defaultValue={featureModule.name}
                      onBlur={(event) => {
                        void renameModule(featureModule.id, event.target.value);
                      }}
                    />
                    <button
                      className="module-delete"
                      onClick={() => {
                        void deleteModule(featureModule.id);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </header>

                  {PRIORITY_LANES.map((lane) => {
                    const laneContainerId = containerId(featureModule.id, lane);
                    const laneCards = sortByPosition(
                      visibleCards.filter(
                        (card) =>
                          card.moduleId === featureModule.id &&
                          card.priorityLane === lane,
                      ),
                    );

                    return (
                      <div className={`lane lane-${lane}`} key={lane}>
                        <div className="lane-header">
                          <p className="lane-title">{LANE_LABELS[lane]}</p>
                          <button
                            className="lane-add"
                            onClick={() => {
                              void createCard(featureModule.id, lane);
                            }}
                            type="button"
                          >
                            +
                          </button>
                        </div>

                        <LaneDropZone
                          disabled={!canDrag}
                          lane={lane}
                          laneId={laneContainerId}
                          moduleId={featureModule.id}
                        >
                          <SortableContext
                            items={laneCards.map((card) => card.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {laneCards.map((card) => (
                              <CardItem
                                card={card}
                                disabled={!canDrag}
                                editingTitle={
                                  editingCardId === card.id ? editingCardTitle : card.title
                                }
                                isEditing={editingCardId === card.id}
                                key={card.id}
                                onDoubleEdit={startInlineCardEdit}
                                onEditingCancel={cancelInlineCardEdit}
                                onEditingSubmit={() => {
                                  void submitInlineCardEdit(card.id);
                                }}
                                onEditingTitleChange={setEditingCardTitle}
                                onSelect={setSelectedCardId}
                                selected={card.id === selectedCardId}
                              />
                            ))}
                          </SortableContext>

                          {laneCards.length === 0 ? (
                            <div className="lane-empty">No stories</div>
                          ) : null}
                        </LaneDropZone>
                      </div>
                    );
                  })}
                </section>
              ))
            )}
          </div>

          <DragOverlay>
            {activeCard ? <OverlayCard card={activeCard} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <aside className="details-panel">
        {selectedCard && detailDraft ? (
          <>
            <h2 className="text-lg font-semibold text-[var(--text)]">Story details</h2>
            <label className="form-field mt-3">
              <span>Title</span>
              <input
                className="input"
                onChange={(event) =>
                  setDetailDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          title: event.target.value,
                        }
                      : previous,
                  )
                }
                value={detailDraft.title}
              />
            </label>

            <label className="form-field mt-3">
              <span>Description</span>
              <textarea
                className="input min-h-[120px] resize-y"
                onChange={(event) =>
                  setDetailDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          description: event.target.value,
                        }
                      : previous,
                  )
                }
                value={detailDraft.description}
              />
            </label>

            <label className="form-field mt-3">
              <span>Effort</span>
              <select
                className="input"
                onChange={(event) =>
                  setDetailDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          effort: event.target.value as EffortLevel,
                        }
                      : previous,
                  )
                }
                value={detailDraft.effort}
              >
                {EFFORT_LEVELS.map((effort) => (
                  <option key={effort} value={effort}>
                    {effort.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field mt-3">
              <span>Target week</span>
              <input
                className="input"
                onChange={(event) =>
                  setDetailDraft((previous) =>
                    previous
                      ? {
                          ...previous,
                          weekTarget: event.target.value,
                        }
                      : previous,
                  )
                }
                type="week"
                value={detailDraft.weekTarget}
              />
            </label>

            <div className="mt-5 flex items-center gap-2">
              <button
                className="primary-btn"
                onClick={() => {
                  void saveDetailDraft();
                }}
                type="button"
              >
                Save changes
              </button>
              <button
                className="danger-btn"
                onClick={() => {
                  void deleteCard(selectedCard.id);
                }}
                type="button"
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">Select a card to edit title, effort, and week target.</div>
        )}
      </aside>
    </main>
  );
}
