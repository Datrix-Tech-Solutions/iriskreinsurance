'use client';

import { Icons } from '@/components/atoms/icons';

interface Activity {
  id: string;
  title: string;
  description?: string;
  date: string;
}

interface RecentActivitiesProps {
  activities: Activity[];
  onViewAll?: () => void;
}

const CalendarIcon = () => <Icons.Calendar />;

export function RecentActivities({ activities, onViewAll }: RecentActivitiesProps) {
  return (
    <div className="border border-gray-200 rounded-card flex flex-col h-full">
      {/* Fixed header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activities</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-sm text-brand font-medium hover:underline">
            View All
          </button>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col divide-y divide-gray-100">
        {activities.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-center gap-4 px-6 py-4">
              {/* Left accent bar */}
              <div className="w-1 self-stretch rounded-full bg-brand shrink-0" />

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {activity.title}
                </p>
                {activity.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{activity.description}</p>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
                <CalendarIcon />
                <span>{activity.date}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
