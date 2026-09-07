import { DetailField } from '@/components/atoms/DetailField';
import { AccountingContact } from '@/types/accounting';

interface AccountingContactsTabProps {
  contacts: AccountingContact[];
}

export function AccountingContactsTab({ contacts }: AccountingContactsTabProps) {
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
  const additional = contacts.filter((c) => !c.isPrimary);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      {primary ? (
        <div className="flex flex-col gap-4">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Primary Contact
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
            <DetailField label="Name" value={primary.fullName} />
            {primary.jobTitle && <DetailField label="Job Title" value={primary.jobTitle} />}
            {primary.email && <DetailField label="Email" value={primary.email} />}
            {primary.phone && <DetailField label="Phone" value={primary.phone} />}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">No contacts on record.</p>
      )}

      {additional.length > 0 && (
        <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Additional Contacts
          </span>
          {additional.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5"
            >
              <DetailField label="Name" value={c.fullName} />
              {c.jobTitle && <DetailField label="Job Title" value={c.jobTitle} />}
              {c.email && <DetailField label="Email" value={c.email} />}
              {c.phone && <DetailField label="Phone" value={c.phone} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
