import { redirect } from 'next/navigation';

export default async function AccountingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  redirect(`/${tenantSlug}/accounting/dashboard`);
}
