import { memo, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import NoteCard, { type NoteObject } from "../../Components/NoteCard";
import { getNoteId, noop, getNotebookDroppableId } from "./homePageUtils";

interface SortableNoteCardProps {
  note: NoteObject;
  selectedTags?: string[];
  onTagClick?: (tag: string) => void;
  onOpenNoteInsights?: ((note: NoteObject) => void) | null;
}

export const SortableNoteCard = memo(function SortableNoteCard({
  note,
  selectedTags,
  onTagClick,
  onOpenNoteInsights,
}: SortableNoteCardProps) {
  const id = getNoteId(note) ?? "";
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition ??
      (transform ? "transform 180ms cubic-bezier(0.2, 0, 0, 1)" : undefined),
    zIndex: isDragging ? 2 : undefined,
    pointerEvents: isDragging ? "none" : undefined,
    touchAction: "none",
    willChange: "transform",
  };

  return (
    <NoteCard
      note={note}
      customizeMode
      selectionMode={false}
      selected={false}
      onSelectionChange={noop}
      selectedTags={selectedTags}
      onTagClick={onTagClick}
      innerRef={setNodeRef}
      dragHandleProps={{ ...attributes, ...listeners }}
      dragHandleRef={setActivatorNodeRef}
      style={style}
      dragging={isDragging}
      onOpenInsights={onOpenNoteInsights}
    />
  );
});

interface DraggableBoardNoteProps {
  note: NoteObject;
  selectionMode?: boolean;
  customizeMode?: boolean;
  selected?: boolean;
  onSelectionChange?: NoteObject extends infer _T ? React.ComponentProps<typeof NoteCard>["onSelectionChange"] : never;
  onTagClick?: (tag: string) => void;
  selectedTags?: string[];
  onOpenNoteInsights?: ((note: NoteObject) => void) | null;
}

export const DraggableBoardNote = memo(function DraggableBoardNote({
  note,
  selectionMode,
  customizeMode,
  selected,
  onSelectionChange,
  onTagClick,
  selectedTags,
  onOpenNoteInsights,
}: DraggableBoardNoteProps) {
  const noteId = getNoteId(note) ?? "";
  const disabled = customizeMode;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: noteId,
      data: { type: "note", noteId },
      disabled,
    });

  const dragStyleRaw: CSSProperties = transform
    ? {
        transform: CSS.Transform.toString(transform),
      }
    : {};

  if (isDragging) {
    dragStyleRaw.opacity = 0;
  }

  const dragStyle = Object.keys(dragStyleRaw).length ? dragStyleRaw : undefined;

  return (
    <NoteCard
      note={note}
      selectionMode={selectionMode}
      selected={selected}
      onSelectionChange={onSelectionChange}
      onTagClick={onTagClick}
      selectedTags={selectedTags}
      customizeMode={customizeMode}
      innerRef={setNodeRef}
      cardDragProps={disabled ? null : { ...attributes, ...listeners }}
      style={dragStyle}
      dragging={isDragging}
      onOpenInsights={onOpenNoteInsights}
    />
  );
});

export function NotebookDropZone({
  notebookId,
  disabled = false,
  children,
}: {
  notebookId: string;
  disabled?: boolean;
  children: (props: { setNodeRef?: (node: HTMLElement | null) => void; isOver: boolean }) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getNotebookDroppableId(notebookId),
    disabled,
    data: { notebookId: notebookId ?? "uncategorized" },
  });

  return children({
    setNodeRef: disabled ? undefined : setNodeRef,
    isOver: !disabled && isOver,
  });
}
