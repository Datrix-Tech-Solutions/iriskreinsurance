import { Badge } from '@/components/atoms/Badge';

interface StatusBadgeProps {
  status: string;
}

const statusMap: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  // Employee / tenant statuses
  ACTIVE: { label: 'Active', variant: 'success' },
  ERROR: { label: 'Error', variant: 'danger' },
  DISCONNECTED: { label: 'Disconnected', variant: 'neutral' },
  PENDING: { label: 'Pending', variant: 'warning' },
  PENDING_VERIFICATION: { label: 'Pending', variant: 'warning' },
  SUSPENDED: { label: 'Suspended', variant: 'danger' },
  INACTIVE: { label: 'Inactive', variant: 'danger' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  ON_LEAVE: { label: 'On Leave', variant: 'info' },
  PROBATION: { label: 'Probation', variant: 'warning' },
  TERMINATED: { label: 'Terminated', variant: 'danger' },
  // Payroll statuses
  PAID: { label: 'Paid', variant: 'success' },
  UNPAID: { label: 'Unpaid', variant: 'warning' },
  // Employee offboard status
  OFFBOARDED: { label: 'Offboarded', variant: 'neutral' },
  // Appraisal cycle statuses
  Upcoming: { label: 'Upcoming', variant: 'info' },
  InProgress: { label: 'In Progress', variant: 'warning' },
  Completed: { label: 'Completed', variant: 'success' },
  Cancelled: { label: 'Cancelled', variant: 'danger' },
  // Employee appraisal statuses
  NotStarted: { label: 'Not Started', variant: 'neutral' },
  SelfSubmitted: { label: 'Self Submitted', variant: 'info' },
  ManagerSubmitted: { label: 'Manager Submitted', variant: 'warning' },
  HRPending: { label: 'HR Pending', variant: 'warning' },
  Finalized: { label: 'Finalized', variant: 'success' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge label={config.label} variant={config.variant} />;
}
