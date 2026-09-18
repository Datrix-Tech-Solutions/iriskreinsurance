'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { RoleFormFields, RoleFormValues } from '@/components/molecules/roles/RoleFormFields';
import {
  PermissionMatrix,
  FeaturePermissions,
} from '@/components/molecules/roles/PermissionMatrix';
import { usePermissionResources } from '@/hooks/hr/useRoles';
import type { PermissionSetResourceDto, PermissionAction, PermissionSet } from '@/types/roles';
import {
  reverseTransformFeaturePermissions,
  transformFeaturePermissions,
} from '@/lib/permissionMap';

export interface PermissionSetSubmitValues {
  name: string;
  description?: string;
  resources: PermissionSetResourceDto[];
}

interface CreatePermissionSetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PermissionSetSubmitValues) => void;
  isSubmitting?: boolean;
  /** Pass an existing set to open in edit mode */
  editTarget?: PermissionSet | null;
}

function PanelInner({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  editTarget,
}: CreatePermissionSetPanelProps) {
  const { data: resources = [] } = usePermissionResources();

  const resourceIdMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) m.set(r.name, r.id);
    return m;
  }, [resources]);

  const initialPermissions = useMemo<FeaturePermissions>(() => {
    if (!editTarget) return {};
    const backendPerms: Record<string, string[]> = {};
    for (const r of editTarget.resources) {
      const name = r.resource.name;
      if (!backendPerms[name]) backendPerms[name] = [];
      backendPerms[name].push(r.action);
    }
    return reverseTransformFeaturePermissions(backendPerms);
  }, [editTarget]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleFormValues>({
    defaultValues: {
      name: editTarget?.name ?? '',
      description: editTarget?.description ?? '',
    },
  });

  const [featurePermissions, setFeaturePermissions] =
    useState<FeaturePermissions>(initialPermissions);

  const onValid = (values: RoleFormValues) => {
    const seen = new Set<string>();
    const resourceDtos: PermissionSetResourceDto[] = [];

    const backendPermissions = transformFeaturePermissions(featurePermissions);
    for (const [resource, actions] of Object.entries(backendPermissions)) {
      const resourceId = resourceIdMap.get(resource);
      if (!resourceId) continue;
      for (const action of actions) {
        const key = `${resourceId}:${action}`;
        if (seen.has(key)) continue;
        seen.add(key);
        resourceDtos.push({ resourceId, action: action as PermissionAction });
      }
    }

    onSubmit({
      name: values.name,
      description: values.description || undefined,
      resources: resourceDtos,
    });
  };

  const isEdit = !!editTarget;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Permission Set' : 'Create Permission Set'}
      description="Define a reusable bundle of permissions that can be assigned to users."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} loadingText="Saving..." onClick={handleSubmit(onValid)}>
            {isEdit ? 'Save Changes' : 'Create Set'}
          </Button>
        </div>
      }
    >
      <RoleFormFields register={register} errors={errors} />
      <PermissionMatrix value={featurePermissions} onChange={setFeaturePermissions} />
    </SidePanel>
  );
}

export function CreatePermissionSetPanel({ isOpen, ...props }: CreatePermissionSetPanelProps) {
  return <PanelInner key={props.editTarget?.id ?? 'new'} isOpen={isOpen} {...props} />;
}
