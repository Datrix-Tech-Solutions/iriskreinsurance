export function EmployeeDetailSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Banner */}
      <div className="p-4 sm:p-6 lg:px-8 lg:pt-8 shrink-0">
        <div className="relative w-full rounded-card rounded-t-none bg-gray-200 animate-pulse h-40 sm:h-44">
          <div className="absolute left-5 sm:left-6 -bottom-7">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-gray-300 ring-2 ring-white/40" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 sm:px-6 lg:px-8 shrink-0 flex gap-2 pt-10">
        {[64, 88, 72, 96].map((w, i) => (
          <div
            key={i}
            className="h-8 rounded-t-xl bg-gray-100 animate-pulse"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left — personal information list */}
            <div className="w-full lg:w-56 shrink-0 flex flex-col gap-3">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1">
                  <div className="w-6 h-6 rounded-md bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-2.5 w-14 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* Right — stacked cards */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {[176, 120, 200, 160].map((h, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-card animate-pulse"
                  style={{ height: h }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
