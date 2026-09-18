'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import {
  PermissionTagSelector,
  buildPermissionResources,
} from '@/components/molecules/roles/PermissionTagSelector';
import { useCreatePermissionSet, usePermissionResources } from '@/hooks/hr/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

export default function NewPermissionSetPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = use(params);
  const router = useRouter();
  const toast = useToast();

  const base = `/${tenantSlug}/hr/hrmanagement/roles`;

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
        resources: buildPermissionResources(selectedTags, resourceIdMap),
      },
      {
        onSuccess: () => {
          toast.success('Permission set created');
          router.push(base);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create permission set')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={base} className="hover:text-gray-700 transition-colors">
          Roles &amp; Permissions
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-700 font-medium">New Permission Set</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">New Permission Set</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Define a reusable bundle of permissions that can be assigned to users.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="secondary" onClick={() => router.push(base)} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Creating..." onClick={handleSubmit(onValid)}>
            Create Set
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
          <PermissionTagSelector value={selectedTags} onChange={setSelectedTags} />
        </div>
      </div>
    </div>
  );
}
