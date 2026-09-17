import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { richContentClass } from './RichTextEditor';

interface RichTextViewProps {
  /** HTML string produced by `RichTextEditor` (paragraphs, lists, tables, …). */
  html: string | null | undefined;
  /** Rendered when `html` is empty. Defaults to an em dash. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * Read-only counterpart to `RichTextEditor`. Renders stored rich-text HTML with
 * the same element styling the editor uses, so tables/lists/headings show as
 * formatted content instead of raw markup.
 *
 * NOTE: the HTML is injected without sanitization, matching the other
 * `dangerouslySetInnerHTML` call sites for this content. Safe only because the
 * comment is authored by internal staff — revisit if that ever changes.
 */
export function RichTextView({ html, fallback = '—', className }: RichTextViewProps) {
  const trimmed = html?.trim();
  if (!trimmed) {
    return <p className="text-sm text-gray-400">{fallback}</p>;
  }

  return (
    <div
      data-rich-text
      className={cn(richContentClass, className)}
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}
