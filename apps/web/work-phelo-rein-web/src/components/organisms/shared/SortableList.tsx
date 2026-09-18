'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Search } from 'lucide-react';
import { cn, cardClass, inputClass } from '@/lib/utils';
import { SortableListRow } from '@/components/molecules/shared/SortableListRow';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';

export interface SortableListItem {
  id: string;
  label: string;
  sublabel: string;
}

interface SortableListProps {
  title: string;
  addLabel?: string;
  items: SortableListItem[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (orderedIds: string[]) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function SortableList({
  title,
  addLabel = 'Add',
  items,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  searchValue = '',
  onSearchChange,
  className,
}: SortableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === String(active.id));
    const newIndex = items.findIndex((i) => i.id === String(over.id));
    const reordered = arrayMove(items, oldIndex, newIndex);
    onReorder(reordered.map((i) => i.id));
  }

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
  const activeIndex = activeItem ? items.findIndex((i) => i.id === activeId) : -1;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top card — title + toolbar */}
      <div className={cardClass('overflow-hidden')}>
        <div className="px-4 py-2 ">
          <h3 className="text-l font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
        </div>
        <div className="flex items-center gap-3 px-4 py-2">
          {onSearchChange && (
            <div className="relative flex-1 min-w-40 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className={inputClass(undefined, 'pl-9 pr-4 py-2')}
              />
            </div>
          )}
          <div className="flex-1" />
          <Button size="sm" onClick={onAdd} className="group">
            {addLabel}
            <span className="inline-flex overflow-hidden w-0 group-hover:w-4 group-hover:ml-1.5 transition-[width,margin] duration-300 ease-out">
              <Icons.Plus className="w-4 h-4 shrink-0 -translate-x-4 group-hover:translate-x-0 transition-transform duration-300 ease-out" />
            </span>
          </Button>
        </div>
      </div>

      {/* Bottom card — list content */}
      <div className={cardClass('overflow-hidden')}>
        <div className="p-3 flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No items yet.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item, index) => (
                  <SortableListRow
                    key={item.id}
                    id={item.id}
                    index={index}
                    label={item.label}
                    sublabel={item.sublabel}
                    onEdit={() => onEdit(item.id)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                {activeItem && (
                  <SortableListRow
                    id={activeItem.id}
                    index={activeIndex}
                    label={activeItem.label}
                    sublabel={activeItem.sublabel}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}
