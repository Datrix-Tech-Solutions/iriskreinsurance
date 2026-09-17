import { redirect } from 'next/navigation';

export default async function ProspectingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/marketing/prospecting/sales-pipeline`);
}
