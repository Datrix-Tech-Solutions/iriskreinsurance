import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  ASSET_STATUS_OPTIONS,
  ASSET_TYPE_OPTIONS,
  ASSET_CONDITION_OPTIONS,
} from '@/lib/assetOptions';

interface AssetFilterBarProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  conditionFilter: string;
  onConditionChange: (v: string) => void;
  showClear: boolean;
  onClear: () => void;
}

export function AssetFilterBar({
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  conditionFilter,
  onConditionChange,
  showClear,
  onClear,
}: AssetFilterBarProps) {
  return (
    <>
      <div className="w-44">
        <SearchSelect
          placeholder="All Statuses"
          size="sm"
          value={statusFilter}
          onChange={onStatusChange}
          options={[{ value: '', label: 'All Statuses' }, ...ASSET_STATUS_OPTIONS]}
        />
      </div>
      <div className="w-44">
        <SearchSelect
          placeholder="All Types"
          size="sm"
          value={typeFilter}
          onChange={onTypeChange}
          options={[{ value: '', label: 'All Types' }, ...ASSET_TYPE_OPTIONS]}
        />
      </div>
      <div className="w-44">
        <SearchSelect
          placeholder="All Conditions"
          size="sm"
          value={conditionFilter}
          onChange={onConditionChange}
          options={[{ value: '', label: 'All Conditions' }, ...ASSET_CONDITION_OPTIONS]}
        />
      </div>
      {showClear && (
        <button
          onClick={onClear}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          Clear filters
        </button>
      )}
    </>
  );
}
