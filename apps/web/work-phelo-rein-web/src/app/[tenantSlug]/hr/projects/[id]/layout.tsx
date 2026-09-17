'use client';

import { use } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageBreadcrumb, pagePx } from '@/lib/layout';
import { ProjectBanner } from '@/components/molecules/hr/projects/ProjectBanner';
import { useProject } from '@/hooks';

const TAB_ACTIVE =
  'relative text-brand font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t-full';
const TAB_IDLE = 'text-gray-500 hover:text-gray-800';

export default function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);
  const pathname = usePathname();
  const base = `/${tenantSlug}/hr/projects`;
  const root = `${base}/${id}`;

  const { data: project, isLoading } = useProject(id);

  if (isLoading) {
    return (
      <div className={cn(pageBreadcrumb, 'flex flex-col gap-6 flex-1 min-h-0 animate-pulse')}>
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-24 bg-gray-200 rounded-card" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!project) {
    return <div className={cn(pageBreadcrumb, 'text-sm text-gray-500')}>Project not found.</div>;
  }

  const tabs = [
    { label: 'Project Details', href: `${root}/details` },
    { label: 'Project Tasks', href: `${root}/tasks` },
    { label: 'Project Board', href: `${root}/board` },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Fixed breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={base} className="hover:text-gray-700 transition-colors">
            Projects
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 font-medium">{project.name}</span>
        </nav>
      </div>

      {/* Scroll container — not a flex container so children grow to full natural height */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={cn(pagePx, 'flex flex-col gap-6 pt-4 pb-8')}>
          <ProjectBanner project={project} />

          {/* Tabs */}
          <div className="flex items-end gap-1 border-b border-gray-200">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative px-6 py-3 text-sm transition-colors whitespace-nowrap',
                    isActive ? TAB_ACTIVE : TAB_IDLE,
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
