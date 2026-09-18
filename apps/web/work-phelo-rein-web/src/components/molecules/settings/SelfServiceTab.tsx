'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { AxiosError } from 'axios';
import { FileImage, Upload } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { useToast } from '@/hooks/useToast';
import {
  useTenantDocumentProfile,
  useUpdateTenantDocumentProfile,
  useUploadTenantDocumentAsset,
} from '@/hooks/useTenantDocumentProfile';
import { useAuthStore } from '@/store/auth.store';
import {
  TenantDocumentProfile,
  UpsertTenantDocumentProfilePayload,
} from '@/types/tenant-document-profile';

type SignatureFormValues = {
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
};

const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatBytes(value: number | null): string {
  if (value === null) return 'Not available';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function signatureDefaults(profile?: TenantDocumentProfile): SignatureFormValues {
  return {
    authorizedSignatoryName: profile?.authorizedSignatoryName ?? '',
    authorizedSignatoryTitle: profile?.authorizedSignatoryTitle ?? '',
  };
}

function toProfilePayload(
  profile: TenantDocumentProfile | undefined,
  values: SignatureFormValues,
): UpsertTenantDocumentProfilePayload {
  return {
    displayName: profile?.displayName || undefined,
    legalName: profile?.legalName || undefined,
    registrationNumber: profile?.registrationNumber ?? undefined,
    taxNumber: profile?.taxNumber ?? undefined,
    physicalAddress: profile?.physicalAddress ?? undefined,
    postalAddress: profile?.postalAddress ?? undefined,
    phone: profile?.phone ?? undefined,
    email: profile?.email ?? undefined,
    website: profile?.website ?? undefined,
    footerText: profile?.footerText ?? undefined,
    defaultCurrency: profile?.defaultCurrency || undefined,
    authorizedSignatoryName: nullableText(values.authorizedSignatoryName),
    authorizedSignatoryTitle: nullableText(values.authorizedSignatoryTitle),
  };
}

export function SelfServiceTab() {
  const user = useAuthStore((state) => state.user);
  const tenantId = user?.tenantId;
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN';
  const toast = useToast();
  const { data: profile, isLoading, isError } = useTenantDocumentProfile(tenantId);
  const updateProfile = useUpdateTenantDocumentProfile(tenantId ?? '');

  const { register, handleSubmit, reset } = useForm<SignatureFormValues>({
    defaultValues: signatureDefaults(),
  });

  useEffect(() => {
    if (profile) reset(signatureDefaults(profile));
  }, [profile, reset]);

  if (!canManage || !tenantId) {
    return (
      <div className="py-6 max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Authorized Signature</h3>
          <p className="mt-2 text-sm text-gray-500">
            Only tenant administrators can manage official document branding.
          </p>
        </div>
      </div>
    );
  }

  const onSubmit = (values: SignatureFormValues) => {
    updateProfile.mutate(toProfilePayload(profile, values), {
      onSuccess: () => toast.success('Signatory saved'),
      onError: (error) => toast.error(errorMessage(error, 'Failed to save signatory')),
    });
  };

  return (
    <div className="py-6 flex flex-col gap-6 max-w-3xl">
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Document profile could not be loaded. Please refresh and try again.
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-gray-200 bg-white p-6"
      >
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900">Authorized Signature</h3>
          <p className="mt-1 text-sm text-gray-500">
            The signature image and the signatory name and title shown on official document signing
            blocks.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <AssetUploadCard
            tenantId={tenantId}
            assetType="signature"
            title="Signature"
            description="PNG, JPEG or WEBP. Max 1 MB. Stored privately for official document signing blocks."
            fileName={profile?.signatureFileName ?? null}
            mimeType={profile?.signatureMimeType ?? null}
            sizeBytes={profile?.signatureSizeBytes ?? null}
            maxBytes={1024 * 1024}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Signatory Name" registration={register('authorizedSignatoryName')} />
            <FormField
              label="Signatory Title"
              registration={register('authorizedSignatoryTitle')}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <Button
            type="submit"
            isLoading={updateProfile.isPending || isLoading}
            loadingText="Saving..."
          >
            Save Signatory
          </Button>
        </div>
      </form>
    </div>
  );
}

function AssetUploadCard({
  tenantId,
  assetType,
  title,
  description,
  fileName,
  mimeType,
  sizeBytes,
  maxBytes,
}: {
  tenantId: string;
  assetType: 'logo' | 'signature';
  title: string;
  description: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  maxBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const upload = useUploadTenantDocumentAsset(tenantId, assetType);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!allowedImageTypes.has(file.type)) {
      toast.error('Image must be PNG, JPEG or WEBP.');
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`${title} must be ${formatBytes(maxBytes)} or smaller.`);
      return;
    }

    upload.mutate(file, {
      onSuccess: () => {
        toast.success(`${title} uploaded`);
        if (inputRef.current) inputRef.current.value = '';
      },
      onError: (error) =>
        toast.error(errorMessage(error, `Failed to upload ${title.toLowerCase()}`)),
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-gray-100 p-2 text-gray-600">
          <FileImage className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
        {fileName ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">File</dt>
              <dd className="truncate font-medium text-gray-900">{fileName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900">{mimeType ?? 'Not available'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Size</dt>
              <dd className="font-medium text-gray-900">{formatBytes(sizeBytes)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">No {assetType} uploaded yet.</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          isLoading={upload.isPending}
          loadingText="Uploading..."
          onClick={() => inputRef.current?.click()}
          icon={<Upload className="h-4 w-4" />}
        >
          {fileName ? 'Replace File' : 'Upload File'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}
