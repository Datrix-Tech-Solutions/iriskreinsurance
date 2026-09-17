import { Skeleton } from '@/components/atoms/Skeleton';

export function TabPageSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {[...Array(tabs)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-b-none" />
        ))}
      </div>

      {/* Content rows */}
      <div className="bg-white border border-gray-200 rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-24 ml-auto" />
        </div>

        <div className="divide-y divide-gray-50">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 grid grid-cols-5 gap-4 items-center">
              {[...Array(5)].map((_, j) => (
                <Skeleton key={j} className={`h-4 ${j === 4 ? 'w-16 ml-auto' : ''}`} />
              ))}
            </div>
          ))}
        </div>
      </div>

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
