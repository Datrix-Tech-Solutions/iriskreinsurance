import { LeaveBalance } from '@/types/hr';

interface BalanceCardProps {
  balance: LeaveBalance;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const pct = balance.entitled > 0 ? Math.min(100, (balance.used / balance.entitled) * 100) : 0;
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{balance.leaveTypeName}</p>
        <span className="text-xs text-gray-400 shrink-0">{balance.entitled} days/yr</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          <span className="font-semibold text-gray-900">{balance.remaining}</span> remaining
        </span>
        <span className="text-gray-400">{balance.used} used</span>
      </div>
      {balance.pending > 0 && (
        <p className="text-xs text-orange-500">
          {balance.pending} day{balance.pending !== 1 ? 's' : ''} pending approval
        </p>
      )}
      {balance.carriedOver > 0 && (
        <p className="text-xs text-blue-500">{balance.carriedOver} carried over</p>
      )}
    </div>
  );
}
