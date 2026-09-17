'use client';

import { Search } from 'lucide-react';
import { cn, cardClass, inputClass } from '@/lib/utils';
import { CardListRow } from '@/components/molecules/shared/CardListRow';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';

export interface CardListItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface CardListProps {
  title?: string;
  addLabel?: string;
  items: CardListItem[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function CardList({
  title,
  addLabel = 'Add',
  items,
  onAdd,
  onEdit,
  onDelete,
  searchValue = '',
  onSearchChange,
  className,
}: CardListProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top card — title + toolbar */}
      <div className={cardClass('overflow-hidden')}>
        {title && (
          <div className="px-4 py-2">
            <h3 className="text-l font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
          </div>
        )}
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
            items.map((item) => (
              <CardListRow
                key={item.id}
                label={item.label}
                sublabel={item.sublabel}
                onEdit={() => onEdit(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
