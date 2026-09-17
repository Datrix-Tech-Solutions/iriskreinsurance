import { redirect } from 'next/navigation';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
  redirect(`/${tenantSlug}/hr/projects/${id}/details`);
}
