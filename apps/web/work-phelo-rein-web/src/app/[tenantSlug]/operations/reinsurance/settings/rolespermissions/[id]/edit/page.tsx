'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import {
  OperationsPermissionsSection,
  buildOperationsPermissionResources,
  inferOperationsTagsFromResources,
} from '@/components/molecules/reinsurance/roles/OperationsPermissionsSection';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import {
  usePermissionSets,
  usePermissionResources,
  useUpdatePermissionSet,
} from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

export default function EditOperationsRolePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const canEditRoles = usePermissionRule('permission-sets:EDIT');

  const base = `/${tenantSlug}/operations/reinsurance/settings/rolespermissions`;

  const { data: sets = [], isLoading } = usePermissionSets();
  const set = sets.find((s) => s.id === id);
  const { mutate: updateSet, isPending } = useUpdatePermissionSet();
  const { data: resources = [] } = usePermissionResources();

  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsInitialised, setTagsInitialised] = useState(false);

  // Seed tags from the set's resources on first load (render-time setState is safe here).
  if (set && !tagsInitialised) {
    setSelectedTags(inferOperationsTagsFromResources(set.resources));
    setTagsInitialised(true);
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({ defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (set) {
      reset({ name: set.name, description: set.description ?? '' });
    }
  }, [set, reset]);

  const onValid = (values: RoleFormValues) => {
    updateSet(
      {
        id,
        name: values.name,
        description: values.description || undefined,
        resources: buildOperationsPermissionResources(selectedTags, resourceIdMap),
      },
      {
        onSuccess: () => {
          toast.success('Role updated');
          router.push(base);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update role')),
      },
    );
  };

  if (!canEditRoles) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        You don&apos;t have permission to edit roles.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!set) {
    return <div className="text-sm text-gray-500">Role not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Roles &amp; Permissions
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">{set.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Edit Role</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Update the name, description, and permissions for this role.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => router.push(base)} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving..." onClick={handleSubmit(onValid)}>
            Save Changes
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
