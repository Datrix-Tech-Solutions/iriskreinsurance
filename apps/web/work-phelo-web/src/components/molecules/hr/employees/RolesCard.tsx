import { ShieldCheck } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';

interface RolesCardProps {
  roles: string[];
}

export function RolesCard({ roles }: RolesCardProps) {
  if (roles.length === 0) return null;

  return (
    <SectionCard title="Roles">
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <div
            key={role}
            className="flex items-center gap-1.5 rounded-md bg-brand/10 px-2.5 py-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-sm font-medium text-gray-700">{role}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
