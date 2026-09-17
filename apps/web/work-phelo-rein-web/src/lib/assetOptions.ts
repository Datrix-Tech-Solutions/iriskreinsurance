export const ASSET_TYPE_OPTIONS = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'PRINTER', label: 'Printer' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'SOFTWARE_LICENSE', label: 'Software License' },
  { value: 'OTHER', label: 'Other' },
];

export const ASSET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

// Resolves the type label to display for an asset, preferring the user-supplied
// custom label when the type is 'OTHER'.
export function getAssetTypeLabel(asset: { type: string; customType?: string | null }): string {
  if (asset.type === 'OTHER' && asset.customType) return asset.customType;
  return ASSET_TYPE_LABELS[asset.type] ?? asset.type;
}

export const ASSET_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'SEDAN', label: 'Sedan' },
  { value: 'SUV', label: 'SUV' },
  { value: 'PICKUP', label: 'Pickup / Truck' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Minibus' },
  { value: 'BUS', label: 'Bus' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'TRUCK', label: 'Heavy Truck' },
  { value: 'OTHER', label: 'Other' },
];

export const ASSET_CONDITION_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
];
