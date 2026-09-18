'use client';

import { SourceEventsTable } from '@/components/organisms/accounting/tables/SourceEventsTable';

export default function SourceEventsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Posting Inbox</h2>
        <p className="mt-1 text-sm text-gray-600">
          Post confirmed operational events to Accounting or retry events that failed validation.
        </p>
      </div>
      <SourceEventsTable />
    </div>
  );
}
