'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { VendorOverview } from '@/components/molecules/accounting/VendorOverview';
import { AccountingContactsTab } from '@/components/molecules/accounting/AccountingContactsTab';
import { PartyStatementTable } from '@/components/organisms/accounting/PartyStatementTable';
import { AccountingContact } from '@/types/accounting';
import { Button } from '@/components/atoms/Button';
import {
  EditAccountingPartyPanel,
  AccountingPartyEditValues,
} from '@/components/organisms/accounting/panels/EditAccountingPartyPanel';
import {
  useAccountingConfig,
  useActivateVendor,
  useDeactivateVendor,
  useUpdateVendor,
  useVendor,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type VendorTab = 'transactions' | 'contacts';

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'contacts', label: 'Contacts' },
];

export default function VendorDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; vendorId: string }>;
}) {
  const { tenantSlug, vendorId } = use(params);
  const [activeTab, setActiveTab] = useState<VendorTab>('transactions');
  const [editOpen, setEditOpen] = useState(false);

  const { data: vendor, isLoading } = useVendor(vendorId);
  const { data: config } = useAccountingConfig();
  const base = `/${tenantSlug}/accounting/settings/vendors`;
  const updateVendor = useUpdateVendor();
  const deactivateVendor = useDeactivateVendor();
  const activateVendor = useActivateVendor();
  const toast = useToast();

  const save = async (values: AccountingPartyEditValues) => {
    try {
      await updateVendor.mutateAsync({ id: vendorId, ...values });
      setEditOpen(false);
      toast.success('Vendor updated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update vendor'));
    }
  };
  const toggleActive = async () => {
    if (!vendor) return;
    try {
      await (vendor.isActive ? deactivateVendor : activateVendor).mutateAsync(vendorId);
      toast.success(vendor.isActive ? 'Vendor deactivated' : 'Vendor activated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update vendor status'));
    }
  };

  const contacts: AccountingContact[] =
    vendor && vendor.primaryContactName
      ? [
          {
            id: vendor.id,
            fullName: vendor.primaryContactName,
            jobTitle: null,
            email: vendor.email,
            phone: vendor.phone,
            isPrimary: true,
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Vendors
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{vendor?.legalName ?? '—'}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !vendor ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Vendor not found.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant={vendor.isActive ? 'danger' : 'outline'}
              onClick={toggleActive}
              isLoading={deactivateVendor.isPending || activateVendor.isPending}
            >
              {vendor.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button onClick={() => setEditOpen(true)}>Edit Vendor</Button>
          </div>
          <VendorOverview vendor={vendor} baseCurrency={config?.baseCurrency ?? undefined} />

          <div className="flex flex-col">
            <TabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as VendorTab)}
            />
            <div className="pt-5">
              {activeTab === 'transactions' && (
                <PartyStatementTable side="payables" partyId={vendorId} />
              )}
              {activeTab === 'contacts' && <AccountingContactsTab contacts={contacts} />}
            </div>
          </div>
          <EditAccountingPartyPanel
            party={vendor}
            label="Vendor"
            isOpen={editOpen}
            isSaving={updateVendor.isPending}
            onClose={() => setEditOpen(false)}
            onSave={save}
          />
        </>
      )}
    </div>
  );
}
