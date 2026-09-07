export enum TenantStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logo?: string;
  status: TenantStatus;
  country: string;
  createdAt: Date;
}
