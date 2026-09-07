import { Skeleton } from '@/components/atoms/Skeleton';

export function TablePageSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table card */}
      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        {/* Search / filter bar */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-24 ml-auto" />
        </div>

        {/* Table header */}
        <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y divide-gray-50">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 grid grid-cols-5 gap-4 items-center">
              {[...Array(5)].map((_, j) => (
                <Skeleton key={j} className={`h-4 ${j === 4 ? 'w-16 ml-auto' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-8" />
          ))}
        </div>
      </div>
    </div>
  );
}
