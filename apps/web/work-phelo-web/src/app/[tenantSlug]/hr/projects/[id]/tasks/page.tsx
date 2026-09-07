'use client';

import { use } from 'react';
import { ProjectTasksTable } from '@/components/organisms/hr/projects/ProjectTasksTable';

export default function ProjectTaskPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectTasksTable projectId={id} />;
}
