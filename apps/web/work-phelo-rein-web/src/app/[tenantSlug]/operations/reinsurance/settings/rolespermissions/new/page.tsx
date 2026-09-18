'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import {
  OperationsPermissionsSection,
  buildOperationsPermissionResources,
} from '@/components/molecules/reinsurance/roles/OperationsPermissionsSection';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useCreatePermissionSet, usePermissionResources } from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

export default function NewOperationsRolePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const toast = useToast();
  const canCreateRoles = usePermissionRule('permission-sets:CREATE');

  const base = `/${tenantSlug}/operations/reinsurance/settings/rolespermissions`;

  const { mutate: createSet, isPending } = useCreatePermissionSet();
  const { data: resources = [] } = usePermissionResources();

  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormValues>({ defaultValues: { name: '', description: '' } });

  const onValid = (values: RoleFormValues) => {
    createSet(
      {
        name: values.name,
        description: values.description || undefined,
        resources: buildOperationsPermissionResources(selectedTags, resourceIdMap),
      },
      {
        onSuccess: () => {
          toast.success('Role created');
          router.push(base);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create role')),
      },
    );
  };

  if (!canCreateRoles) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        You don&apos;t have permission to create roles.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Roles &amp; Permissions
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">New Role</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">New Role</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Define a reusable role that can be assigned to operations users.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => router.push(base)} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Creating..." onClick={handleSubmit(onValid)}>
            Create Role
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8 lg:items-start">
        {/* Left: form */}
        <div className="w-full lg:w-96 lg:shrink-0 flex flex-col gap-5">
          <RoleFormFields register={register} errors={errors} />
        </div>

        <div className="hidden lg:block w-px self-stretch bg-gray-100 shrink-0" />
        <div className="lg:hidden h-px bg-gray-100" />

        {/* Right: permissions */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Permissions</p>
            <p className="text-sm text-gray-400 mt-0.5">Select what this role can do.</p>
          </div>
          <OperationsPermissionsSection value={selectedTags} onChange={setSelectedTags} />
        </div>
      </div>
    </div>
  );
}
