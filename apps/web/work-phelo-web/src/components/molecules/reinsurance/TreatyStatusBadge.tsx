import { Badge } from '@/components/atoms/Badge';
import { TreatyStatus } from '@/types/reinsurance';

const VARIANT_MAP: Record<TreatyStatus, 'success' | 'warning' | 'neutral' | 'danger'> = {
  Active: 'success',
  Pending: 'warning',
  Expired: 'neutral',
  Cancelled: 'danger',
};

interface TreatyStatusBadgeProps {
  status: TreatyStatus;
}

export function TreatyStatusBadge({ status }: TreatyStatusBadgeProps) {
  return <Badge label={status} variant={VARIANT_MAP[status]} />;
}
