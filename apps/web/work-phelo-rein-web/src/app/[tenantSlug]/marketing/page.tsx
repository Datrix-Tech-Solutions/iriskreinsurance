import { redirect } from 'next/navigation';

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  redirect(`/${tenantSlug}/marketing/dashboard`);
}
