'use client';

import { use } from 'react';
import { useProject } from '@/hooks';
import { ProjectDetailsCard } from '@/components/molecules/hr/projects/ProjectDetailsCard';
import { ProjectMembersTable } from '@/components/organisms/hr/projects/ProjectMembersTable';

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  const { data: project } = useProject(id);

  return (
    <div className="flex flex-col gap-6">
      {project && <ProjectDetailsCard project={project} />}
      <ProjectMembersTable projectId={id} />
    </div>
  );
}
