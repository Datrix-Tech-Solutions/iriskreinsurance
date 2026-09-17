'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { CustomerOverview } from '@/components/molecules/accounting/CustomerOverview';
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
  useActivateCustomer,
  useCustomer,
  useDeactivateCustomer,
  useUpdateCustomer,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

type CustomerTab = 'transactions' | 'contacts';

const TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'contacts', label: 'Contacts' },
];

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; customerId: string }>;
}) {
  const { tenantSlug, customerId } = use(params);
  const [activeTab, setActiveTab] = useState<CustomerTab>('transactions');
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading } = useCustomer(customerId);
  const { data: config } = useAccountingConfig();
  const base = `/${tenantSlug}/accounting/settings/customers`;
  const updateCustomer = useUpdateCustomer();
  const deactivateCustomer = useDeactivateCustomer();
  const activateCustomer = useActivateCustomer();
  const toast = useToast();

  const save = async (values: AccountingPartyEditValues) => {
    try {
      await updateCustomer.mutateAsync({ id: customerId, ...values });
      setEditOpen(false);
      toast.success('Customer updated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update customer'));
    }
  };
  const toggleActive = async () => {
    if (!customer) return;
    try {
      await (customer.isActive ? deactivateCustomer : activateCustomer).mutateAsync(customerId);
      toast.success(customer.isActive ? 'Customer deactivated' : 'Customer activated');
    } catch (error) {
      toast.error(extractError(error, 'Unable to update customer status'));
    }
  };

  const contacts: AccountingContact[] =
    customer && customer.primaryContactName
      ? [
          {
            id: customer.id,
            fullName: customer.primaryContactName,
            jobTitle: null,
            email: customer.email,
            phone: customer.phone,
            isPrimary: true,
          },
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Customers
        </Link>
        <Icons.ChevronRight className="w-5 h-5" />
        <span className="text-gray-700 font-medium">{customer?.legalName ?? '—'}</span>
      </nav>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      ) : !customer ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">
          Customer not found.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant={customer.isActive ? 'danger' : 'outline'}
              onClick={toggleActive}
              isLoading={deactivateCustomer.isPending || activateCustomer.isPending}
            >
              {customer.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button onClick={() => setEditOpen(true)}>Edit Customer</Button>
          </div>
          <CustomerOverview customer={customer} baseCurrency={config?.baseCurrency ?? undefined} />

          <div className="flex flex-col">
            <TabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(t) => setActiveTab(t as CustomerTab)}
            />
            <div className="pt-5">
              {activeTab === 'transactions' && (
                <PartyStatementTable side="receivables" partyId={customerId} />
              )}
              {activeTab === 'contacts' && <AccountingContactsTab contacts={contacts} />}
            </div>
          </div>
          <EditAccountingPartyPanel
            party={customer}
            label="Customer"
            isOpen={editOpen}
            isSaving={updateCustomer.isPending}
            onClose={() => setEditOpen(false)}
            onSave={save}
          />
        </>
      )}
    </div>
  );
}
