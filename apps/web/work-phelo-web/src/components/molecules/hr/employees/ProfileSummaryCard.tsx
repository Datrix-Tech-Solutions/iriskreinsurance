import { Fragment, type ReactNode } from 'react';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import type { Employee } from '@/types/hr';

interface ProfileSummaryCardProps {
  employee: Employee;
  managerName?: string;
}

function formatDate(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEnum(val?: string | null) {
  if (!val) return undefined;
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTenure(iso?: string | null) {
  if (!iso) return undefined;
  const start = new Date(iso);
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months <= 0) return 'less than a month';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rem) parts.push(`${rem} ${rem === 1 ? 'month' : 'months'}`);
  return parts.join(' ');
}

export function ProfileSummaryCard({ employee, managerName }: ProfileSummaryCardProps) {
  const probationActive =
    employee.employmentType !== 'CONTRACT' &&
    !!employee.probationEndsAt &&
    new Date(employee.probationEndsAt) >= new Date();

  const location =
    employee.branch?.name ||
    [employee.city, employee.region].filter(Boolean).join(', ') ||
    undefined;
  const joinedDate = formatDate(employee.hireDate);
  const tenure = formatTenure(employee.hireDate);
  const employmentType = formatEnum(employee.employmentType);
  const strong = (text: string) => <span className="font-medium text-gray-900">{text}</span>;

  const clauses: ReactNode[] = [];
  if (employee.jobTitle) clauses.push(<>Works as a {strong(employee.jobTitle)}</>);
  if (managerName) clauses.push(<>reports to {strong(managerName)}</>);
  if (location) clauses.push(<>is based in {strong(location)}</>);
  if (employee.department?.name || employmentType) {
    clauses.push(
      <>
        {employee.department?.name && <>is part of {strong(employee.department.name)}</>}
        {employee.department?.name && employmentType ? ' ' : ''}
        {employmentType && <>as a {strong(employmentType.toLowerCase())} employee</>}
      </>,
    );
  }
  if (joinedDate) {
    clauses.push(
      <>
        joined {strong(joinedDate)}
        {tenure && <> ({strong(tenure)} of tenure)</>}
      </>,
    );
  }
  if (probationActive) {
    clauses.push(<>is on probation until {strong(formatDate(employee.probationEndsAt) ?? '')}</>);
  }

  return (
    <SectionCard title="About">
      <p className="text-sm leading-relaxed text-gray-600">
        {clauses.map((clause, i) => (
          <Fragment key={i}>
            {i === 0 ? '' : i === clauses.length - 1 ? ', and ' : ', '}
            {clause}
          </Fragment>
        ))}
        {clauses.length > 0 && '.'}
      </p>
    </SectionCard>
  );
}
