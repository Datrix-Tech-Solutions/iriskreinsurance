export function EmployeeDetailSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        <div className="text-gray-400">›</div>
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex justify-end gap-3">
        <div className="h-9 w-28 bg-gray-100 rounded-input animate-pulse" />
        <div className="h-9 w-32 bg-gray-100 rounded-input animate-pulse" />
        <div className="h-9 w-24 bg-gray-100 rounded-input animate-pulse" />
      </div>

      <div className="flex gap-6 items-start">
        {/* Left Profile Skeleton */}
        <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-card p-6 flex flex-col gap-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full animate-pulse mx-auto" />
          <div className="h-5 w-40 bg-gray-100 rounded mx-auto animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded mx-auto animate-pulse" />
          <div className="w-full border-t border-gray-100 my-2" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>

        {/* Right Sections Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-card h-44 animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
