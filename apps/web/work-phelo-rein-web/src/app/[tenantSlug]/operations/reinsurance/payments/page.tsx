import { PaymentsTable } from '@/components/organisms/reinsurance/tables/Paymentstable';
import { PremiumsStatsRow } from '@/components/molecules/reinsurance/stats/PremiumsStatsRow';

export default function ReinsurancePaymentsPage() {
  return (
    <div className="flex flex-col p-6 min-h-0 overflow-y-auto flex-1">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Payments</h2>
        <p className="text-sm text-gray-500">Manage payment requests and disbursements</p>
      </div>
      <PremiumsStatsRow />
      <PaymentsTable />
    </div>
  );
}
