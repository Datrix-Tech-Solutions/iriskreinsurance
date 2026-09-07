'use client';

import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cardClass } from '@/lib/utils';

export interface InlineTableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'right';
  renderField: (index: number) => React.ReactNode;
  renderFooter?: () => React.ReactNode;
}

interface InlineTableProps {
  title: string;
  addLabel?: string;
  columns: InlineTableColumn[];
  fieldIds: string[];
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  /** Optional extra line rendered below the totals footer, e.g. a balance/difference summary. */
  footerNote?: React.ReactNode;
}

export function InlineTable({
  title,
  addLabel = 'Add Row',
  columns,
  fieldIds,
  onAddRow,
  onRemoveRow,
  footerNote,
}: InlineTableProps) {
  const colTemplate = [...columns.map((c) => c.width ?? '1fr'), '44px'].join(' ');
  const hasFooter = columns.some((c) => c.renderFooter);

  return (
    <div className={cardClass('overflow-hidden')}>
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddRow}
          icon={<Icons.Plus className="w-4 h-4" />}
        >
          {addLabel}
        </Button>
      </div>

      {/* Scrollable table body */}
      <div className="overflow-x-auto">
        <div className="min-w-max w-full">
          {/* Column headers — floating pill matching DataTable */}
          <div className="pt-3">
            <div className="relative shrink-0">
              <div
                className={cardClass(
                  'absolute inset-y-0 left-4 right-4 bg-(--table-header-bg,var(--color-gray-200)) rounded-lg',
                  'glass',
                )}
              />
              <div
                className="relative grid text-xs font-semibold text-(--table-header-text,var(--module-btn-bg,var(--color-brand))) uppercase tracking-wide px-6 py-3"
                style={{ gridTemplateColumns: colTemplate }}
              >
                {columns.map((col) => (
                  <span key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {col.label}
                  </span>
                ))}
                <span />
              </div>
            </div>
          </div>

          {/* Rows */}
          {fieldIds.map((id, index) => (
            <div
              key={id}
              className="grid border-b border-gray-100 last:border-b-0 items-start px-4"
              style={{ gridTemplateColumns: colTemplate }}
            >
              {columns.map((col) => (
                <div key={col.key} className="p-2">
                  {col.renderField(index)}
                </div>
              ))}
              <div className="p-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => fieldIds.length > 1 && onRemoveRow(index)}
                  disabled={fieldIds.length === 1}
                  className="p-2 text-gray-500 hover:text-red-700 disabled:opacity-90 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-red-200"
                  aria-label="Remove row"
                >
                  <Icons.Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {/* Footer — floating pill matching column header */}
          {hasFooter && (
            <div className="pb-3">
              <div className="relative">
                <div
                  className={cardClass(
                    'absolute inset-y-0 left-4 right-4 bg-(--table-header-bg,var(--color-gray-200)) rounded-lg',
                    'glass',
                  )}
                />
                <div
                  className="relative grid px-6 py-3"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className={
                        col.align === 'right'
                          ? 'flex items-center justify-end text-sm font-semibold text-gray-900'
                          : 'flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wide'
                      }
                    >
                      {col.renderFooter?.()}
                    </div>
                  ))}
                  <div />
                </div>
              </div>
              {footerNote && <div className="flex justify-end px-6 pt-2">{footerNote}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
