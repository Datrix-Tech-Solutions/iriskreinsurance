import { cn, cardClass } from '@/lib/utils';

export function SectionCard({
  title,
  children,
  scrollX,
  className,
  contentClassName,
  headerAction,
}: {
  title: string;
  children: React.ReactNode;
  scrollX?: boolean;
  className?: string;
  contentClassName?: string;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className={cardClass(cn('overflow-hidden', className))}>
      <div className="px-6 py-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {headerAction}
      </div>
      {scrollX ? (
        <div className="overflow-x-auto">
          <div className="flex gap-4 px-6 py-5" style={{ width: 'max-content', minWidth: '100%' }}>
            {children}
          </div>
        </div>
      ) : (
        <div className={cn('px-6 py-5', contentClassName)}>{children}</div>
      )}
    </div>
  );
}
