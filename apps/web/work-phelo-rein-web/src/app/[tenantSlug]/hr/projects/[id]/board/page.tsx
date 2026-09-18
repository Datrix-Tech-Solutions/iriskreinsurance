'use client';

import { use } from 'react';
import { ProjectBoard } from '@/components/organisms/hr/projects/ProjectBoard';

export default function ProjectBoardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  return <ProjectBoard projectId={id} />;
}
