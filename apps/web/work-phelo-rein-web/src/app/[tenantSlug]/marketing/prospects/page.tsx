import { redirect } from 'next/navigation';

export default async function ProspectsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/marketing/prospects/all`);
}
