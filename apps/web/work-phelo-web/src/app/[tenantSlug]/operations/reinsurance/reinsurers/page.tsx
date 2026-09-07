import { ReinsurersTable } from '@/components/organisms/reinsurance/tables/ReinsurersTable';

export default function ReinsurersPage() {
  return (
    <div className="flex flex-col gap-6 p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Reinsurers</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage individual Reinsurers</p>
      </div>
      <ReinsurersTable />
    </div>
  );
}
