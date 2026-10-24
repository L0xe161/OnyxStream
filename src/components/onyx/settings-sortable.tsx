"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  visible: boolean;
}

interface Labels {
  drag: string;
  up: string;
  down: string;
}

function Row({ item, label, index, count, labels, onToggle, onMove }: { item: Item; label: string; index: number; count: number; labels: Labels; onToggle: (id: string) => void; onMove: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-[var(--radius-lg)] bg-muted/60 py-1.5 ps-1 pe-3", isDragging && "relative z-10 bg-muted shadow-lg")}
    >
      <button type="button" aria-label={`${labels.drag}: ${label}`} className="grid size-9 cursor-grab touch-none place-items-center rounded-full text-muted-foreground hover:text-foreground active:cursor-grabbing focus-visible:outline-2" {...attributes} {...listeners}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className={cn("min-w-0 flex-1 truncate", !item.visible && "text-muted-foreground")}>{label}</span>
      <div className="flex items-center">
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`${labels.up}: ${label}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:outline-2">
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`${labels.down}: ${label}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 focus-visible:outline-2">
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>
      <Switch checked={item.visible} onCheckedChange={() => onToggle(item.id)} aria-label={label} />
    </li>
  );
}

interface SortableListProps<T extends Item> {
  items: T[];
  labelFor: (id: T["id"]) => string;
  labels: Labels;
  onChange: (items: T[]) => void;
}

/** Reorderable, toggleable list. Drag with pointer or keyboard, or use the arrow buttons. */
export function SortableList<T extends Item>({ items, labelFor, labels, onChange }: SortableListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5 py-3">
          {items.map((item, index) => (
            <Row key={item.id} item={item} label={labelFor(item.id)} index={index} count={items.length} labels={labels} onMove={move} onToggle={(id) => onChange(items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)))} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
