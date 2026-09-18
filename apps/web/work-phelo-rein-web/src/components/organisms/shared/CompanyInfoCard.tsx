'use client';

import { useRef } from 'react';
import { Pencil } from 'lucide-react';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { Button } from '@/components/atoms/Button';
import { useUploadTenantBrandingAsset } from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';

/* ── Types ── */

interface AdminInfo {
  name: string;
  status: string;
  email: string;
}

interface CompanyInfoCardProps {
  id: string;
  name: string;
  slug: string;
  size?: string;
  industry?: string;
  location?: string;
  address?: string;
  contact?: string;
  logoUrl?: string;
  admin?: AdminInfo;
  onEditCompany: () => void;
  onEditAdmin: () => void;
  onResendInvite?: () => void;
  isResendingInvite?: boolean;
}

/* ── Sub-components ── */

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 truncate">{value ?? '—'}</span>
    </div>
  );
}

function CompanyAvatar({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    return (
      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          width={56}
          height={56}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0">
      {initials}
    </div>
  );
}

/* ── Main component ── */

export function CompanyInfoCard({
  id,
  name,
  slug,
  size,
  industry,
  location,
  address,
  contact,
  logoUrl,
  admin,
  onEditCompany,
  onEditAdmin,
}: CompanyInfoCardProps) {
  const toast = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadLogo, isPending: isUploadingLogo } = useUploadTenantBrandingAsset(
    id,
    'app-logo',
  );

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    uploadLogo(file, {
      onSuccess: () => toast.success('Logo uploaded'),
      onError: () => toast.error('Failed to upload logo'),
    });
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  return (
    <div className="border border-gray-200 rounded-card bg-white flex flex-col overflow-hidden">
      {/* ── Top: avatar + name + company info ── */}
      <div className="flex items-start gap-4 px-5 py-4 border-b border-gray-100">
        <CompanyAvatar name={name} logoUrl={logoUrl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{slug}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onEditCompany}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <InfoField label="Size" value={size} />
            <InfoField label="Industry" value={industry} />
            <InfoField label="Location" value={location} />
            <InfoField label="Address" value={address} />
            <InfoField label="Contact" value={contact} />
          </div>
        </div>
      </div>

      {/* ── Middle: company logo ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Company Logo
          </h3>
          <Button
            variant="outline"
            size="sm"
            isLoading={isUploadingLogo}
            loadingText="Uploading..."
            onClick={() => logoInputRef.current?.click()}
          >
            {logoUrl ? 'Change Logo' : 'Upload Logo'}
          </Button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => handleLogoFile(e.target.files?.[0])}
          />
        </div>
        {logoUrl ? (
          <div className="relative w-full max-w-55 h-16 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`${name} logo`}
              className="absolute inset-0 w-full h-full object-contain p-2"
            />
          </div>
        ) : (
          <div className="w-full max-w-55 h-16 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
            <span className="text-xs text-gray-400">No logo uploaded</span>
          </div>
        )}
      </div>

      {/* ── Bottom: administrator ── */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Administrator
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEditAdmin}>
              {admin ? 'Update Admin' : 'Assign Admin'}
            </Button>
          </div>
        </div>

        {admin ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            <InfoField label="Name" value={admin.name} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">Status</span>
              <div className="w-fit">
                <StatusBadge status={admin.status} />
              </div>
            </div>
            <InfoField label="Work Email" value={admin.email} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No administrator assigned.</p>
        )}
      </div>
    </div>
  );
}
