'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AssetTypeIcon } from '@/components/atoms/assetIcons';
import { AssetDetailPanel } from '@/components/organisms/hr/assets/AssetDetailPanel';
import { Badge } from '@/components/atoms/Badge';
import { useAssets } from '@/hooks/hr/useAssets';
import { getAssetTypeLabel } from '@/lib/assetOptions';
import type { Asset, AssetStatus } from '@/types/asset';

const STATUS_VARIANT: Record<AssetStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
};

const PAGE_SIZE = 8;

interface Props {
  branchId: string;
}

export function BranchAssetsTab({ branchId }: Props) {
  const { data: assets = [], isLoading } = useAssets();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets.filter((a) => {
      if (a.branchId !== branchId) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.serialNumber?.toLowerCase().includes(q) ||
        getAssetTypeLabel(a).toLowerCase().includes(q)
      );
    });
  }, [assets, branchId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Asset>[] = [
    {
      key: 'name',
      label: 'Asset',
      render: (row) => (
        <div className="flex items-center gap-3">
          <AssetTypeIcon type={row.type} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            <p className="text-xs text-gray-400">{getAssetTypeLabel(row)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'serialNumber',
      label: 'Serial Number',
      render: (row) => <span className="text-sm text-gray-500">{row.serialNumber ?? '—'}</span>,
    },
    {
      key: 'assignedEmployeeName',
      label: 'Assigned To',
      render: (row) => (
        <span className="text-sm text-gray-500">{row.assignedEmployeeName ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <Badge variant={STATUS_VARIANT[row.status]} label={row.status} />,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search assets..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onRowClick={setSelectedAsset}
        emptyMessage="No assets assigned to this branch"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AssetDetailPanel
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        asset={selectedAsset}
      />
    </>
  );
}
