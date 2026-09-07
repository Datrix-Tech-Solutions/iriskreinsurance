import { Skeleton } from '@/components/atoms/Skeleton';

export function DashboardSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-hidden">
      {/* Welcome banner */}
      <Skeleton className="h-20 rounded-card shrink-0" />

      {/* Stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-card px-5 py-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left column */}
        <div className="flex flex-col gap-4 min-h-0">
          <Skeleton className="flex-1 rounded-card" />
          <Skeleton className="h-40 rounded-card shrink-0" />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 min-h-0">
          <Skeleton className="h-36 rounded-card shrink-0" />
          <Skeleton className="flex-1 rounded-card" />
        </div>
      </div>
    </div>
  );
}
