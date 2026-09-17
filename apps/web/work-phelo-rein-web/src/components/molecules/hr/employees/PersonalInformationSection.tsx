import {
  User,
  Phone,
  Calendar,
  PersonStanding,
  Heart,
  Globe,
  IdCard,
  MapPin,
  LifeBuoy,
  PhoneCall,
  type LucideIcon,
} from 'lucide-react';
import { frostedAvatarStyle } from '@/lib/utils';
import type { Employee } from '@/types/hr';

const ICON_COLOR = 'var(--module-btn-bg, var(--color-brand))';

function formatDate(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEnum(val?: string | null) {
  if (!val) return undefined;
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  employee: Employee;
  showNationalId?: boolean;
}

export function PersonalInformationSection({ employee, showNationalId }: Props) {
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || undefined;
  const fullAddress =
    [employee.address, employee.city, employee.region].filter(Boolean).join(', ') || undefined;
  const emergencyContact = employee.emergencyName
    ? employee.emergencyRelation
      ? `${employee.emergencyName} (${employee.emergencyRelation})`
      : employee.emergencyName
    : undefined;

  const rows: { icon: LucideIcon; label: string; value?: string }[] = [
    { icon: User, label: 'Name', value: fullName },
    { icon: Phone, label: 'Phone', value: employee.phone },
    { icon: Calendar, label: 'Date of Birth', value: formatDate(employee.dateOfBirth) },
    { icon: PersonStanding, label: 'Gender', value: formatEnum(employee.gender) },
    { icon: Heart, label: 'Marital Status', value: formatEnum(employee.maritalStatus) },
    { icon: Globe, label: 'Nationality', value: employee.nationality },
    ...(showNationalId
      ? [{ icon: IdCard, label: 'National ID', value: employee.nationalId } as const]
      : []),
    { icon: MapPin, label: 'Address', value: fullAddress },
    { icon: LifeBuoy, label: 'Emergency Contact', value: emergencyContact },
    { icon: PhoneCall, label: 'Emergency Phone', value: employee.emergencyPhone },
  ];

  const visible = rows.filter((r) => r.value);

  return (
    <div className="max-w-xs">
      <h3 className="text-xs font-semibold text-(--module-btn-bg,var(--color-brand)) mb-2">Personal Information</h3>
      <ul className="flex flex-col divide-y divide-gray-100">
        {visible.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-white backdrop-blur-sm border border-white/30"
              style={frostedAvatarStyle(ICON_COLOR)}
            >
              <Icon className="w-3 h-3" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-xs font-medium text-gray-900 wrap-break-word">{value}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
