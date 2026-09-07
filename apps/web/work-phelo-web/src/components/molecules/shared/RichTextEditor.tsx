'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  // FileText,
  Heading2,
  CheckSquare,
  // Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Table,
  Underline,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Styles applied inside the editable area, the preview pane, and the read-only
// `RichTextView` renderer.
export const richContentClass = [
  'text-sm text-gray-900',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2',
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-1',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2',
  '[&_li]:my-0.5',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:my-2',
  '[&_a]:text-brand [&_a]:underline',
  '[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:rounded [&_code]:font-mono [&_code]:text-[0.8em]',
  '[&_pre]:bg-gray-100 [&_pre]:rounded [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto [&_pre]:my-2',
  // Tables are wrapped in `.rt-table-scroll` (see `insertTableFromGrid`) so a
  // table with more columns than the editor is wide scrolls inside its own box
  // instead of overflowing the comment area. The margin lives on the wrapper so
  // the scrollbar hugs the last row; a table that predates the wrapper keeps its
  // own `my-2`.
  '[&_.rt-table-scroll]:block [&_.rt-table-scroll]:max-w-full [&_.rt-table-scroll]:overflow-x-auto [&_.rt-table-scroll]:my-2',
  '[&_.rt-table-scroll_table]:my-0',
  '[&_table]:border-collapse [&_table]:w-full [&_table]:my-2',
  // `h-8` acts as a min-height on table cells, so empty rows match the height a
  // filled row settles at (one `text-sm` line + padding) instead of collapsing.
  '[&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:h-8 [&_th]:bg-gray-50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-sm',
  '[&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:h-8 [&_td]:text-sm',
  '[&_img]:max-w-full [&_img]:rounded [&_img]:my-1',
].join(' ');

const btnClass =
  'p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors';

const GRID_COLS = 10;
const GRID_ROWS = 8;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  minHeight?: number;
  onFilesAdded?: (files: FileList) => void;
}

// ─── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarBtn({
  title,
  action,
  arg,
  active,
  onMouseDown,
  children,
}: {
  title: string;
  action?: string;
  arg?: string;
  active?: boolean;
  onMouseDown: React.MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      data-action={action}
      data-arg={arg}
      onMouseDown={onMouseDown}
      className={cn(btnClass, active && 'bg-brand-tint text-brand')}
    >
      {children}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write here…',
  label,
  error,
  minHeight = 160,
  onFilesAdded,
}: RichTextEditorProps) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [inTable, setInTable] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [pickerHover, setPickerHover] = useState({ rows: 0, cols: 0 });

  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableBtnRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const activeTdRef = useRef<HTMLTableCellElement | null>(null);

  const isEmpty = !value.replace(/<[^>]*>/g, '').trim();

  // ── External value sync ───────────────────────────────────────────────────

  useEffect(() => {
    if (!contentRef.current) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (contentRef.current.innerHTML !== value) contentRef.current.innerHTML = value;
    // Also re-run when switching back to the "write" tab: that remounts the
    // contentEditable div as a fresh, empty node, so it needs to be
    // re-populated even though `value` itself didn't change.
  }, [value, tab]);

  const syncValue = useCallback(() => {
    isInternalChange.current = true;
    onChange?.(contentRef.current?.innerHTML ?? '');
  }, [onChange]);

  // ── Active format tracking ────────────────────────────────────────────────

  const refreshActiveFormats = useCallback(() => {
    if (!contentRef.current?.contains(document.activeElement)) return;
    const cmds = ['bold', 'italic', 'underline', 'insertOrderedList', 'insertUnorderedList'];
    const active = new Set(
      cmds.filter((cmd) => {
        try {
          return document.queryCommandState(cmd);
        } catch {
          return false;
        }
      }),
    );
    try {
      const blk = document.queryCommandValue('formatBlock').toLowerCase();
      if (blk) active.add(`blk:${blk}`);
    } catch {
      /* noop */
    }
    setActiveFormats(active);

    const anchorNode = window.getSelection()?.anchorNode;
    const td = (anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement)?.closest(
      'td, th',
    ) as HTMLTableCellElement | null;
    activeTdRef.current = td && contentRef.current.contains(td) ? td : null;
    setInTable(!!activeTdRef.current);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshActiveFormats);
    return () => document.removeEventListener('selectionchange', refreshActiveFormats);
  }, [refreshActiveFormats]);

  // Close table picker when clicking outside its button
  useEffect(() => {
    if (!showTablePicker) return;
    const close = (e: MouseEvent) => {
      if (!tableBtnRef.current?.contains(e.target as Node)) setShowTablePicker(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showTablePicker]);

  const isActive = (cmd: string) => activeFormats.has(cmd);
  const isBlk = (tag: string) => activeFormats.has(`blk:${tag}`);

  // ── execCommand dispatcher ────────────────────────────────────────────────

  const handleExecCmd = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const el = contentRef.current;
      if (!el) return;
      el.focus();
      const { action = '', arg } = e.currentTarget.dataset;
      document.execCommand(action, false, arg);
      syncValue();
      refreshActiveFormats();
    },
    [syncValue, refreshActiveFormats],
  );

  // ── Table grid picker ─────────────────────────────────────────────────────

  const insertTableFromGrid = useCallback(
    (rows: number, cols: number) => {
      if (rows === 0 || cols === 0) return;
      setShowTablePicker(false);
      setPickerHover({ rows: 0, cols: 0 });
      contentRef.current?.focus();
      // Bare markup — no per-cell inline styles. Tables are styled by
      // `richContentClass` here and in `RichTextView`, and by the
      // `[data-rich-text] table` rules in globals.css for document/PDF layouts.
      // Keeping the HTML small is what lets tables fit character-limited fields.
      // The `.rt-table-scroll` wrapper gives a wide table its own horizontal
      // scrollbar so it stays contained in the comment area.
      const header = Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join('');
      const bodyRows = Array.from(
        { length: rows },
        () => `<tr>${Array.from({ length: cols }, () => '<td></td>').join('')}</tr>`,
      ).join('');
      const html = `<div class="rt-table-scroll"><table><thead><tr>${header}</tr></thead><tbody>${bodyRows}</tbody></table></div><br/>`;
      document.execCommand('insertHTML', false, html);
      syncValue();
    },
    [syncValue],
  );

  // ── Other toolbar handlers ────────────────────────────────────────────────

  // const handleImageBtn = useCallback(
  //   (e: React.MouseEvent) => {
  //     e.preventDefault();
  //     const url = window.prompt('Enter image URL:');
  //     if (!url) return;
  //     contentRef.current?.focus();
  //     document.execCommand(
  //       'insertHTML',
  //       false,
  //       `<img src="${url}" alt="Image" style="max-width:100%;border-radius:4px;display:block;margin:4px 0;" />`,
  //     );
  //     syncValue();
  //   },
  //   [syncValue],
  // );

  const handleTaskListBtn = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      contentRef.current?.focus();
      document.execCommand(
        'insertHTML',
        false,
        '<div style="display:flex;align-items:center;gap:8px;margin:2px 0;"><input type="checkbox" /><span>Task item</span></div>',
      );
      syncValue();
    },
    [syncValue],
  );

  // const handleFileBtn = useCallback((e: React.MouseEvent) => {
  //   e.preventDefault();
  //   fileInputRef.current?.click();
  // }, []);

  // ── Table row/column operations ───────────────────────────────────────────

  const tableAddRow = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const td = activeTdRef.current;
      if (!td) return;
      const tr = td.closest('tr')!;
      const newRow = document.createElement('tr');
      Array.from(tr.cells).forEach(() => newRow.appendChild(document.createElement('td')));
      tr.after(newRow);
      syncValue();
      refreshActiveFormats();
    },
    [syncValue, refreshActiveFormats],
  );

  const tableRemoveRow = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const td = activeTdRef.current;
      if (!td) return;
      const table = td.closest('table')!;
      if (table.querySelectorAll('tbody tr').length <= 1) return;
      td.closest('tr')!.remove();
      activeTdRef.current = null;
      setInTable(false);
      syncValue();
    },
    [syncValue],
  );

  const tableAddCol = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const td = activeTdRef.current;
      if (!td) return;
      const tr = td.closest('tr')!;
      const table = td.closest('table')!;
      const colIdx = Array.from(tr.cells).indexOf(td);
      Array.from(table.rows).forEach((row) => {
        const isHeader = row.parentElement?.tagName === 'THEAD';
        const refCell = row.cells[colIdx] as HTMLElement | undefined;
        const newCell = document.createElement(isHeader ? 'th' : 'td');
        newCell.textContent = isHeader ? 'Column' : '';
        if (refCell) refCell.after(newCell);
        else row.appendChild(newCell);
      });
      syncValue();
    },
    [syncValue],
  );

  const tableRemoveCol = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const td = activeTdRef.current;
      if (!td) return;
      const tr = td.closest('tr')!;
      if (tr.cells.length <= 1) return;
      const colIdx = Array.from(tr.cells).indexOf(td);
      Array.from(td.closest('table')!.rows).forEach((row) => row.cells[colIdx]?.remove());
      activeTdRef.current = null;
      syncValue();
    },
    [syncValue],
  );

  // ── Tab key navigation inside tables ─────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab') return;
      const anchorNode = window.getSelection()?.anchorNode;
      const currentCell = (
        anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement
      )?.closest('td, th');
      if (!currentCell || !contentRef.current?.contains(currentCell)) return;

      e.preventDefault();

      const table = currentCell.closest('table')!;
      const allCells = Array.from(table.querySelectorAll('td, th'));
      const idx = allCells.indexOf(currentCell as HTMLElement);

      const moveTo = (cell: Element) => {
        const sel = window.getSelection()!;
        const range = document.createRange();
        const target = cell.firstChild ?? cell;
        range.setStart(target, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      };

      if (e.shiftKey) {
        if (idx > 0) moveTo(allCells[idx - 1]);
      } else if (idx < allCells.length - 1) {
        moveTo(allCells[idx + 1]);
      } else {
        // Last cell — append a new row and move into its first cell
        const tbody = table.querySelector('tbody')!;
        const lastRow = tbody.lastElementChild as HTMLTableRowElement;
        const newRow = document.createElement('tr');
        Array.from(lastRow.cells).forEach(() => newRow.appendChild(document.createElement('td')));
        tbody.appendChild(newRow);
        moveTo(newRow.cells[0]);
        syncValue();
      }
    },
    [syncValue],
  );

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileDrop = (e: React.DragEvent) => {
    if (!onFilesAdded) return; // no handler wired up — let the browser's default drop behavior run
    e.preventDefault();
    if (e.dataTransfer.files.length) onFilesAdded(e.dataTransfer.files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (onFilesAdded && e.clipboardData.files.length) {
      e.preventDefault();
      onFilesAdded(e.clipboardData.files);
      return;
    }
    setTimeout(syncValue, 0);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const sep = <span className="w-px h-4 bg-gray-200 mx-0.5 self-center" />;

  return (
    <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
      {label && <label className="text-sm font-bold text-gray-900">{label}</label>}

      {/* overflow-visible so the table grid picker popup isn't clipped */}
      <div
        className={cn(
          'border rounded-input bg-transparent overflow-visible',
          error ? 'border-red-500' : 'border-(--input-border,var(--color-gray-400))',
          'focus-within:ring-1 focus-within:ring-(--input-border,var(--color-gray-400)) focus-within:border-(--input-border,var(--color-gray-400))',
        )}
      >
        {/* ── Tab bar + toolbar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200 px-2 pt-1 gap-2 flex-wrap rounded-t-input">
          <div className="flex">
            {(['write', 'preview'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-t transition-colors capitalize',
                  tab === t
                    ? 'text-brand border-b-2 border-brand'
                    : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'write' && (
            <div className="flex items-center gap-0.5 flex-wrap pb-1">
              <ToolbarBtn
                title="Heading"
                action="formatBlock"
                arg="h2"
                active={isBlk('h2')}
                onMouseDown={handleExecCmd}
              >
                <Heading2 size={15} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Bold"
                action="bold"
                active={isActive('bold')}
                onMouseDown={handleExecCmd}
              >
                <Bold size={15} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Italic"
                action="italic"
                active={isActive('italic')}
                onMouseDown={handleExecCmd}
              >
                <Italic size={15} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Underline"
                action="underline"
                active={isActive('underline')}
                onMouseDown={handleExecCmd}
              >
                <Underline size={15} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Blockquote"
                action="formatBlock"
                arg="blockquote"
                active={isBlk('blockquote')}
                onMouseDown={handleExecCmd}
              >
                <Quote size={15} />
              </ToolbarBtn>

              {sep}

              <ToolbarBtn
                title="Numbered list"
                action="insertOrderedList"
                active={isActive('insertOrderedList')}
                onMouseDown={handleExecCmd}
              >
                <ListOrdered size={15} />
              </ToolbarBtn>
              <ToolbarBtn
                title="Bullet list"
                action="insertUnorderedList"
                active={isActive('insertUnorderedList')}
                onMouseDown={handleExecCmd}
              >
                <List size={15} />
              </ToolbarBtn>
              <ToolbarBtn title="Task list" onMouseDown={handleTaskListBtn}>
                <CheckSquare size={15} />
              </ToolbarBtn>

              {sep}

              {/* Table button with grid picker */}
              <div ref={tableBtnRef} className="relative">
                <button
                  type="button"
                  title="Insert table"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowTablePicker((s) => !s);
                  }}
                  className={cn(btnClass, showTablePicker && 'bg-brand-tint text-brand')}
                >
                  <Table size={15} />
                </button>

                {showTablePicker && (
                  <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 select-none">
                    <div
                      className="grid gap-0.5"
                      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
                      onMouseLeave={() => setPickerHover({ rows: 0, cols: 0 })}
                    >
                      {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => {
                        const row = Math.floor(i / GRID_COLS) + 1;
                        const col = (i % GRID_COLS) + 1;
                        const highlighted = row <= pickerHover.rows && col <= pickerHover.cols;
                        return (
                          <div
                            key={i}
                            onMouseEnter={() => setPickerHover({ rows: row, cols: col })}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              insertTableFromGrid(row, col);
                            }}
                            className={cn(
                              'w-5 h-5 border cursor-pointer transition-colors rounded-sm',
                              highlighted
                                ? 'bg-brand-tint border-brand'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100',
                            )}
                          />
                        );
                      })}
                    </div>
                    <p className="text-center text-xs text-gray-500 mt-2 font-medium tabular-nums">
                      {pickerHover.cols > 0 ? `${pickerHover.cols} × ${pickerHover.rows}` : '0 × 0'}
                    </p>
                  </div>
                )}
              </div>

              {/* <ToolbarBtn title="Insert image" onMouseDown={handleImageBtn}>
                <ImageIcon size={15} />
              </ToolbarBtn>
              {onFilesAdded && (
                <ToolbarBtn title="Attach document" onMouseDown={handleFileBtn}>
                  <FileText size={15} />
                </ToolbarBtn>
              )} */}

              {sep}

              <ToolbarBtn title="Undo" action="undo" onMouseDown={handleExecCmd}>
                <Undo2 size={15} />
              </ToolbarBtn>
              <ToolbarBtn title="Redo" action="redo" onMouseDown={handleExecCmd}>
                <Redo2 size={15} />
              </ToolbarBtn>

              {onFilesAdded && (
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) onFilesAdded(e.target.files);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* ── Table context bar ─────────────────────────────────────── */}
        {inTable && tab === 'write' && (
          <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-3 py-1.5">
            <span className="text-xs text-gray-400 mr-1 font-medium">Table</span>
            <button
              type="button"
              onMouseDown={tableAddRow}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
            >
              + Row
            </button>
            <button
              type="button"
              onMouseDown={tableRemoveRow}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
            >
              − Row
            </button>
            <span className="w-px h-3 bg-gray-200 mx-0.5" />
            <button
              type="button"
              onMouseDown={tableAddCol}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
            >
              + Column
            </button>
            <button
              type="button"
              onMouseDown={tableRemoveCol}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-gray-100 transition-colors text-gray-600"
            >
              − Column
            </button>
          </div>
        )}

        {/* ── Content area ──────────────────────────────────────────── */}
        {tab === 'write' ? (
          <div className="relative">
            {isEmpty && (
              <p className="absolute top-0 left-0 px-4 py-3 text-sm text-gray-400 pointer-events-none select-none">
                {placeholder}
              </p>
            )}
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncValue}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              style={{ minHeight }}
              className={cn('w-full px-4 py-3 focus:outline-none', richContentClass)}
            />
          </div>
        ) : (
          <div
            style={{ minHeight }}
            className={cn('px-4 py-3 overflow-auto', richContentClass)}
            dangerouslySetInnerHTML={{
              __html:
                value || '<p style="color:#9ca3af;font-style:italic;">Nothing to preview.</p>',
            }}
          />
        )}

        {/* ── Footer ────────────────────────────────────────────────── */}
        {onFilesAdded && (
          <div className="flex items-center border-t border-gray-100 px-4 py-2 text-xs text-gray-400 rounded-b-input">
            <span
              className="flex items-center gap-1 cursor-pointer hover:text-gray-600"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              Paste, drop, or click to add files
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
