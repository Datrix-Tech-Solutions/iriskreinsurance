import { AssetType } from '@/components/atoms/assetIcons';

export type AssetStatus = 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR';

export interface Asset {
  id: string;
  assetNumber?: string;
  name: string;
  type: AssetType;
  customType?: string;
  serialNumber?: string;
  vehicleType?: VehicleType;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  condition?: AssetCondition;
  notes?: string;
  status: AssetStatus;
  branchId?: string;
  assignedTo?: string;
  assignedEmployeeName?: string;
  assignedAt?: string;
}

export type VehicleType =
  | 'SEDAN'
  | 'SUV'
  | 'PICKUP'
  | 'VAN'
  | 'BUS'
  | 'MINIBUS'
  | 'MOTORCYCLE'
  | 'TRUCK'
  | 'OTHER';

export interface CreateAssetPayload {
  name: string;
  type: AssetType;
  customType?: string;
  serialNumber?: string;
  vehicleType?: VehicleType;
  purchaseDate?: string;
  purchaseCost?: number;
  currency?: string;
  condition?: AssetCondition;
  notes?: string;
  branchId?: string;
}

export type UpdateAssetPayload = Partial<CreateAssetPayload>;

// Subset used when rendering an employee's assigned assets (assignedAt is always present)
export interface EmployeeAsset {
  id: string;
  name: string;
  type: AssetType;
  assignedAt: string;
  serialNumber?: string;
  condition?: AssetCondition;
}
