'use client';

import { useState, useMemo } from 'react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { AssetFilterBar } from '@/components/molecules/hr/assets/AssetFilterBar';
import { AddAssetPanel } from '@/components/organisms/hr/assets/AddAssetPanel';
import { EditAssetPanel } from '@/components/organisms/hr/assets/EditAssetPanel';
import { AssignAssetPanel } from '@/components/organisms/hr/assets/AssignAssetPanel';
import { TransferAssetPanel } from '@/components/organisms/hr/assets/TransferAssetPanel';
import { RetireAssetModal } from '@/components/organisms/hr/assets/RetireAssetModal';
import { DeleteAssetModal } from '@/components/organisms/hr/assets/DeleteAssetModal';
import { UnassignAssetModal } from '@/components/organisms/hr/assets/UnassignAssetModal';
import { AssetDetailPanel } from '@/components/organisms/hr/assets/AssetDetailPanel';
import AssetCard from '@/components/molecules/AssetCard';
import { AssetStatsRow } from '@/components/molecules/hr/assets/AssetStatsRow';
import { AssetType } from '@/components/atoms/assetIcons';
import { Asset, CreateAssetPayload, UpdateAssetPayload } from '@/types/asset';
import { getAssetTypeLabel } from '@/lib/assetOptions';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import {
  useAssets,
  useCreateAsset,
  useDeleteAsset,
  useAssignAsset,
  useRetireAsset,
  useUnassignAsset,
  useUpdateAsset,
} from '@/hooks/hr/useAssets';
import { useEmployeeOptions } from '@/hooks/hr/useEmployees';
import { useToast } from '@/hooks/useToast';

type PanelState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'detail'; asset: Asset }
  | { type: 'edit'; asset: Asset }
  | { type: 'assign'; asset: Asset }
  | { type: 'unassign'; asset: Asset }
  | { type: 'transfer'; asset: Asset }
  | { type: 'retire'; asset: Asset }
  | { type: 'delete'; asset: Asset };

const PAGE_SIZE = 12;

type AssetForm = {
  name: string;
  type: string;
  customType?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCost?: string;
  currency: string;
  condition?: string;
  notes?: string;
  branchId?: string;
};

export function AssetsContent() {
  const canCreateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canUpdateAsset = usePermission(Permission.MANAGE_ASSETS);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const toast = useToast();
  const { data: assets = [], isLoading } = useAssets();

  const summary = useMemo(
    () => ({
      total: assets.length,
      assigned: assets.filter((a) => a.status === 'ASSIGNED').length,
      available: assets.filter((a) => a.status === 'AVAILABLE').length,
      maintenance: assets.filter((a) => a.status === 'MAINTENANCE').length,
      retired: assets.filter((a) => a.status === 'RETIRED').length,
    }),
    [assets],
  );
  const { data: allEmployeeOptions = [] } = useEmployeeOptions();
  const employees = allEmployeeOptions.filter((employee) =>
    ['ACTIVE', 'PROBATION'].includes(employee.employmentStatus),
  );
  const { mutate: createAsset } = useCreateAsset();
  const { mutate: updateAsset } = useUpdateAsset();
  const { mutate: assignAsset } = useAssignAsset();
  const { mutate: unassignAsset, isPending: isUnassigningAsset } = useUnassignAsset();
  const { mutate: retireAsset, isPending: isRetiringAsset } = useRetireAsset();
  const { mutate: deleteAsset, isPending: isDeletingAsset } = useDeleteAsset();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<PanelState>({ type: 'none' });

  const closePanel = () => setPanel({ type: 'none' });

  const normalizeAssetForm = (data: AssetForm): CreateAssetPayload => {
    const payload: CreateAssetPayload = {
      name: data.name.trim(),
      type: data.type as AssetType,
      currency: data.currency?.trim() || 'GHS',
    };

    if (data.type === 'OTHER' && data.customType?.trim()) {
      payload.customType = data.customType.trim();
    }

    if (data.serialNumber?.trim()) {
      payload.serialNumber = data.serialNumber.trim();
    }

    if (data.purchaseDate) {
      payload.purchaseDate = data.purchaseDate;
    }

    if (data.purchaseCost?.trim()) {
      payload.purchaseCost = Number(data.purchaseCost);
    }

    if (data.condition) {
      payload.condition = data.condition as NonNullable<UpdateAssetPayload['condition']>;
    }

    if (data.notes?.trim()) {
      payload.notes = data.notes.trim();
    }

    if (data.branchId) {
      payload.branchId = data.branchId;
    }

    return payload;
  };

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (statusFilter && asset.status !== statusFilter) return false;
      if (typeFilter && asset.type !== typeFilter) return false;
      if (conditionFilter && asset.condition !== conditionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          asset.name.toLowerCase().includes(q) ||
          asset.serialNumber?.toLowerCase().includes(q) ||
          getAssetTypeLabel(asset).toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [assets, search, statusFilter, typeFilter, conditionFilter]);

  const hasFilters = !!(search || statusFilter || typeFilter || conditionFilter);
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setConditionFilter('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedAssets = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <h1 className="text-xl font-bold text-gray-900 shrink-0">Asset Management</h1>

      <AssetStatsRow isLoading={isLoading} {...summary} />

      <DataCardGrid
        data={pagedAssets}
        isLoading={isLoading}
        skeletonCount={8}
        renderSkeleton={() => <div className="w-80 h-64 rounded-card bg-gray-100 animate-pulse" />}
        searchPlaceholder="Search by name, serial number, type..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={
          canCreateAsset
            ? { label: 'Add Asset', onClick: () => setPanel({ type: 'add' }) }
            : undefined
        }
        extraFilters={
          <AssetFilterBar
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            typeFilter={typeFilter}
            onTypeChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            conditionFilter={conditionFilter}
            onConditionChange={(v) => {
              setConditionFilter(v);
              setPage(1);
            }}
            showClear={hasFilters}
            onClear={clearFilters}
          />
        }
        emptyMessage="No assets found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderCard={(asset) => (
          <AssetCard
            asset={asset}
            onView={() => setPanel({ type: 'detail', asset })}
            onEdit={canUpdateAsset ? () => setPanel({ type: 'edit', asset }) : undefined}
            onAssign={canAssignAsset ? () => setPanel({ type: 'assign', asset }) : undefined}
            onUnassign={canAssignAsset ? () => setPanel({ type: 'unassign', asset }) : undefined}
            onTransfer={canAssignAsset ? () => setPanel({ type: 'transfer', asset }) : undefined}
          />
        )}
      />

      <AssetDetailPanel
        isOpen={panel.type === 'detail'}
        onClose={closePanel}
        asset={panel.type === 'detail' ? panel.asset : null}
        canManage={canUpdateAsset}
        canAssign={canAssignAsset}
        onEdit={
          canUpdateAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'edit', asset: panel.asset })
            : undefined
        }
        onAssign={
          canAssignAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'assign', asset: panel.asset })
            : undefined
        }
        onUnassign={
          canAssignAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'unassign', asset: panel.asset })
            : undefined
        }
        onTransfer={
          canAssignAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'transfer', asset: panel.asset })
            : undefined
        }
        onRetire={
          canUpdateAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'retire', asset: panel.asset })
            : undefined
        }
        onDelete={
          canUpdateAsset && panel.type === 'detail'
            ? () => setPanel({ type: 'delete', asset: panel.asset })
            : undefined
        }
      />

      <AddAssetPanel
        isOpen={panel.type === 'add'}
        onClose={closePanel}
        onSubmit={(data) => {
          createAsset(normalizeAssetForm(data), {
            onSuccess: () => {
              toast.success('Asset created successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to create asset');
            },
          });
        }}
      />

      <EditAssetPanel
        isOpen={panel.type === 'edit'}
        onClose={closePanel}
        asset={panel.type === 'edit' ? panel.asset : null}
        onSubmit={(assetId, data) => {
          updateAsset(
            { id: assetId, ...normalizeAssetForm(data) },
            {
              onSuccess: () => {
                toast.success('Asset updated successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to update asset');
              },
            },
          );
        }}
      />

      <AssignAssetPanel
        isOpen={panel.type === 'assign'}
        onClose={closePanel}
        asset={panel.type === 'assign' ? panel.asset : null}
        employees={employees}
        onAssign={(assetId, employeeId) => {
          assignAsset(
            { assetId, employeeId },
            {
              onSuccess: () => {
                toast.success('Asset assigned successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to assign asset');
              },
            },
          );
        }}
      />

      <TransferAssetPanel
        isOpen={panel.type === 'transfer'}
        onClose={closePanel}
        asset={panel.type === 'transfer' ? panel.asset : null}
        employees={employees}
        onTransfer={(assetId, employeeId) => {
          assignAsset(
            { assetId, employeeId },
            {
              onSuccess: () => {
                toast.success('Asset transferred successfully');
                closePanel();
              },
              onError: () => {
                toast.error('Failed to transfer asset');
              },
            },
          );
        }}
      />

      <RetireAssetModal
        isOpen={panel.type === 'retire'}
        onClose={closePanel}
        asset={panel.type === 'retire' ? panel.asset : null}
        isLoading={isRetiringAsset}
        onConfirm={(assetId) => {
          retireAsset(assetId, {
            onSuccess: () => {
              toast.success('Asset retired successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to retire asset');
            },
          });
        }}
      />

      <DeleteAssetModal
        isOpen={panel.type === 'delete'}
        onClose={closePanel}
        asset={panel.type === 'delete' ? panel.asset : null}
        isLoading={isDeletingAsset}
        onConfirm={(assetId) => {
          deleteAsset(assetId, {
            onSuccess: () => {
              toast.success('Asset deleted successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to delete asset');
            },
          });
        }}
      />

      <UnassignAssetModal
        isOpen={panel.type === 'unassign'}
        onClose={closePanel}
        asset={panel.type === 'unassign' ? panel.asset : null}
        isLoading={isUnassigningAsset}
        onConfirm={(assetId) => {
          unassignAsset(assetId, {
            onSuccess: () => {
              toast.success('Asset unassigned successfully');
              closePanel();
            },
            onError: () => {
              toast.error('Failed to unassign asset');
            },
          });
        }}
      />
    </>
  );
}
