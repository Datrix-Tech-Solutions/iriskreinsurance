import { DetailField } from '@/components/atoms/DetailField';
import { Button } from '@/components/atoms/Button';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

interface ReinsurerInfoCardProps {
  reinsurer: Counterparty;
  onUpdate: () => void;
}

function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

export function ReinsurerInfoCard({ reinsurer, onUpdate }: ReinsurerInfoCardProps) {
  const primaryContact = reinsurer.contacts.find((c) => c.isPrimary) ?? reinsurer.contacts[0];
  const additionalContacts = reinsurer.contacts.filter((c) => !c.isPrimary);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-gray-900">{reinsurer.name}</h2>
          <span className="text-xs text-gray-400">Reinsurer</span>
        </div>
        <Button size="sm" onClick={onUpdate}>
          Update
        </Button>
      </div>

      {/* Core details */}
      <div className="flex flex-col gap-4">
        <DetailField label="Email" value={reinsurer.email ?? '—'} />
        <DetailField label="Phone" value={reinsurer.phone ?? '—'} />
        <DetailField
          label="Brokerage Fee"
          value={reinsurer.brokerageFee != null ? `${reinsurer.brokerageFee}%` : '—'}
        />
        <DetailField label="Territory" value={formatTerritory(reinsurer.addresses)} />
      </div>

      {/* Primary contact */}
      {primaryContact && (
        <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Primary Contact
          </span>
          <DetailField label="Name" value={primaryContact.fullName} />
          {primaryContact.email && <DetailField label="Email" value={primaryContact.email} />}
          {primaryContact.phone && <DetailField label="Phone" value={primaryContact.phone} />}
        </div>
      )}

      {/* Additional contacts */}
      {additionalContacts.length > 0 && (
        <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Additional Contacts
          </span>
          {additionalContacts.map((c) => (
            <div key={c.id} className="flex flex-col gap-3">
              <DetailField label="Name" value={c.fullName} />
              {c.email && <DetailField label="Email" value={c.email} />}
              {c.phone && <DetailField label="Phone" value={c.phone} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
