'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  useReinsuranceAccountingTenantIntegration,
  useUpdateReinsuranceAccountingTenantIntegration,
} from '@/hooks/useModuleConfig';

interface ReinsuranceAccountingIntegrationControlProps {
  tenantId: string;
  canManage: boolean;
}

function moduleState(enabled: boolean): string {
  return enabled ? 'Enabled' : 'Disabled';
}

export function ReinsuranceAccountingIntegrationControl({
  tenantId,
  canManage,
}: ReinsuranceAccountingIntegrationControlProps) {
  const [confirmDisable, setConfirmDisable] = useState(false);
  const { data, isLoading, isError } =
    useReinsuranceAccountingTenantIntegration(tenantId);
  const update = useUpdateReinsuranceAccountingTenantIntegration(tenantId);

  if (isLoading) {
    return <section className="rounded-card border border-gray-200 bg-white p-5 text-sm text-gray-400">Loading integration configuration…</section>;
  }

  if (isError || !data) {
    return <section className="rounded-card border border-red-200 bg-red-50 p-5 text-sm text-red-700">Unable to load the Reinsurance Accounting integration configuration.</section>;
  }

  const modulesAvailable = data.reinsuranceEnabled && data.accountingEnabled;
  const relationshipLabel = data.active ? 'Connected' : 'Disconnected';
  const disabledReason = !modulesAvailable
    ? 'Both Reinsurance and Accounting must be enabled before they can be connected.'
    : !canManage
      ? 'Only a Super Admin can change this relationship.'
      : undefined;

  const enable = () => update.mutate(true);
  const disable = () => update.mutate(false, { onSuccess: () => setConfirmDisable(false) });

  return (
    <>
      <section className="rounded-card border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Reinsurance ↔ Accounting</h3>
            <p className="mt-1 text-sm text-gray-500">
              Module availability and integration are separate. Connected modules share approved Reinsurance financial events with Accounting.
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${data.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
            {relationshipLabel}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Reinsurance module</dt><dd className="mt-1 font-medium text-gray-900">{moduleState(data.reinsuranceEnabled)}</dd></div>
          <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Accounting module</dt><dd className="mt-1 font-medium text-gray-900">{moduleState(data.accountingEnabled)}</dd></div>
          <div className="rounded-lg bg-gray-50 p-3"><dt className="text-gray-500">Integration relationship</dt><dd className="mt-1 font-medium text-gray-900">{relationshipLabel}</dd></div>
        </dl>

        {!data.active && modulesAvailable && (
          <p className="mt-4 text-sm text-gray-600">The modules are intentionally independent. Accounting readiness is not required while disconnected.</p>
        )}
        {disabledReason && <p className="mt-4 text-sm text-gray-500">{disabledReason}</p>}

        {canManage && (
          <div className="mt-4 flex justify-end">
            {data.active ? (
              <Button variant="secondary" onClick={() => setConfirmDisable(true)} disabled={update.isPending}>
                Disconnect modules
              </Button>
            ) : (
              <Button onClick={enable} disabled={!modulesAvailable || update.isPending}>
                {update.isPending ? 'Connecting…' : 'Connect modules'}
              </Button>
            )}
          </div>
        )}
        {update.isError && <p className="mt-3 text-sm text-red-600">Unable to update the integration relationship. Please try again.</p>}
      </section>

      <Modal
        isOpen={confirmDisable}
        onClose={() => !update.isPending && setConfirmDisable(false)}
        title="Disconnect Reinsurance and Accounting?"
        description="Existing Accounting records are retained. Future Reinsurance-to-Accounting synchronization stops, and pending integration events are retained. Both modules continue operating independently."
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmDisable(false)} disabled={update.isPending}>Cancel</Button>
          <Button variant="danger" onClick={disable} disabled={update.isPending}>{update.isPending ? 'Disconnecting…' : 'Disconnect modules'}</Button>
        </div>
      </Modal>
    </>
  );
}
