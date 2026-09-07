'use client';

import { JournalEntriesTable } from '@/components/organisms/accounting/tables/JournalEntriesTable';

export default function JournalEntryPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Journal Entries</h2>
      </div>

      <JournalEntriesTable />
    </div>
  );
}
