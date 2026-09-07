import { Pencil, ShieldCheck } from 'lucide-react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';

interface EmployeeRolesCardProps {
  roles: string[];
  canEdit: boolean;
  onEdit: () => void;
}

export function EmployeeRolesCard({ roles, canEdit, onEdit }: EmployeeRolesCardProps) {
  return (
    <SectionCard title="Roles">
      <div className="flex flex-col gap-2.5 min-h-[48px]">
        {roles.length === 0 ? (
          <p className="text-sm text-gray-400">No roles assigned.</p>
        ) : (
          roles.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              </div>
              <span className="text-sm font-medium text-gray-700">{role}</span>
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Edit Roles
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </SectionCard>
  );
}
