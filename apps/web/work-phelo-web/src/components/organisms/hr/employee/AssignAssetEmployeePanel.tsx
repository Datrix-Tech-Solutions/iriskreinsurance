'use client';

import { useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { getAssetTypeLabel } from '@/lib/assetOptions';

interface AvailableAsset {
  id: string;
  name: string;
  type: string;
  customType?: string;
  condition: string;
  assetNumber: string;
}

interface AssignAssetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  availableAssets: AvailableAsset[];
  onAssign: (assetId: string) => void;
}

export function AssignAssetPanel({
  isOpen,
  onClose,
  employeeName,
  availableAssets,
  onAssign,
}: AssignAssetPanelProps) {
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const filteredAvailableAssets = assetSearch.trim()
    ? availableAssets.filter(
        (a) =>
          a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
          a.assetNumber.toLowerCase().includes(assetSearch.toLowerCase()),
      )
    : [];

  const selectedAsset = availableAssets.find((a) => a.id === selectedAssetId) ?? null;

  const CONDITION_LABELS: Record<string, { label: string; text: string; bg: string }> = {
    NEW: { label: 'New', text: 'text-green-700', bg: 'bg-green-50' },
    GOOD: { label: 'Good', text: 'text-blue-700', bg: 'bg-blue-50' },
    FAIR: { label: 'Fair', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    POOR: { label: 'Poor', text: 'text-red-700', bg: 'bg-red-50' },
  };

  const handleClose = () => {
    setAssetSearch('');
    setSelectedAssetId(null);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Assign Asset"
      description={`Assign an available asset to ${employeeName}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            disabled={!selectedAssetId}
            onClick={() => {
              if (selectedAssetId) {
                onAssign(selectedAssetId);
                handleClose();
              }
            }}
          >
            Assign
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        {/* Search */}
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Search Asset</label>
          <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={assetSearch}
              onChange={(e) => {
                setAssetSearch(e.target.value);
                setSelectedAssetId(null);
              }}
              placeholder="Search by name or asset number…"
              className="w-full h-10 pl-9 pr-4 border border-gray-300 rounded-input text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        </div>

        {/* Results */}
        {assetSearch.trim() && (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {filteredAvailableAssets.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No available assets found</p>
            ) : (
              filteredAvailableAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const cond = CONDITION_LABELS[asset.condition] || CONDITION_LABELS.GOOD;

                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-card border transition-all ${
                      isSelected
                        ? 'border-brand bg-brand-tint ring-1 ring-brand/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{asset.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{asset.assetNumber}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500 shrink-0">
                      {getAssetTypeLabel(asset)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cond.bg} ${cond.text}`}
                    >
                      {cond.label}
                    </span>
                    {isSelected && <Icons.Check />}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Selected summary */}
        {selectedAsset && (
          <div className="flex items-center gap-2 px-4 py-3 bg-brand-tint rounded-card border border-brand/20">
            <Icons.Check />
            <p className="text-sm text-brand font-semibold truncate">
              {selectedAsset.name} selected
            </p>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
