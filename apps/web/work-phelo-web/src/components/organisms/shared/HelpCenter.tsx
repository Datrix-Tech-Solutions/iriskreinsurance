'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageCircleQuestion,
  ChevronRight,
  ArrowUpRight,
  Users,
  CalendarRange,
  CircleDollarSign,
  Trophy,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/organisms/shared/Modal';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

const SEVEN_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type HelpCenterRecord = { seen: boolean; firstSeenAt: number };

function storageKey(userId: string) {
  return `wp_help_center_${userId}`;
}

function getRecord(userId: string): HelpCenterRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as HelpCenterRecord) : null;
  } catch {
    return null;
  }
}

function saveRecord(userId: string, record: HelpCenterRecord) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(record));
  } catch {}
}

function shouldShowBeacon(record: HelpCenterRecord | null): boolean {
  if (!record) return false;
  if (record.seen) return false;
  return Date.now() - record.firstSeenAt < SEVEN_DAYS_MS;
}

type WorkflowStep = {
  title: string;
  description: string;
  buttonLabel: string;
  href: string;
};

type Workflow = {
  id: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
  steps: WorkflowStep[];
};

const WORKFLOWS: Workflow[] = [
  {
    id: 'onboarding',
    title: 'Onboard an Employee',
    tagline: 'Set up prerequisites before adding your first employee.',
    icon: <Users className="w-4 h-4" />,
    steps: [
      {
        title: 'Create a Department',
        description: 'Employees must belong to a department. Set one up first.',
        buttonLabel: 'Go to Departments',
        href: 'hrmanagement/departments',
      },
      {
        title: 'Create a Branch',
        description: 'Branches define the physical locations employees work from.',
        buttonLabel: 'Go to Branches',
        href: 'hrmanagement/branches',
      },
      {
        title: 'Set Up Probation End Date',
        description: 'Configure the default probation period for new hires.',
        buttonLabel: 'Go to Employment Policies',
        href: 'hrmanagement/companyPolicies/employment',
      },
      {
        title: 'Set Up Resignation Notice Period',
        description: 'Define the required notice period when employees resign.',
        buttonLabel: 'Go to Employment Policies',
        href: 'hrmanagement/companyPolicies/employment',
      },
      {
        title: 'Configure Roles & Permissions',
        description: 'Define what each role can access within the platform.',
        buttonLabel: 'Go to Roles',
        href: 'hrmanagement/roles',
      },
      {
        title: 'Onboard Your Employee',
        description: "You're all set. Add your first employee to the system.",
        buttonLabel: 'Go to Employees',
        href: 'employees',
      },
    ],
  },
  {
    id: 'leave',
    title: 'Set Up Leave Management',
    tagline: 'Configure leave types and holidays before employees can request leave.',
    icon: <CalendarRange className="w-4 h-4" />,
    steps: [
      {
        title: 'Create Leave Types',
        description: 'Define the types of leave available (e.g. Annual, Sick, Maternity).',
        buttonLabel: 'Go to Leave Types',
        href: 'hrmanagement/leave-types',
      },
      {
        title: 'Add Public Holidays',
        description: 'Set the public holidays that apply to your organisation.',
        buttonLabel: 'Go to Public Holidays',
        href: 'hrmanagement/public-holidays',
      },
      {
        title: 'Manage Leave Requests',
        description: 'Once configured, employees can submit and track leave requests.',
        buttonLabel: 'Go to Leave',
        href: 'leave',
      },
    ],
  },
  {
    id: 'payroll',
    title: 'Run Payroll',
    tagline: "You're ready to run payroll for your employees.",
    icon: <CircleDollarSign className="w-4 h-4" />,
    steps: [
      {
        title: 'Process Payroll',
        description: "You're ready to run payroll for your employees.",
        buttonLabel: 'Go to Payroll',
        href: 'payroll',
      },
    ],
  },
  {
    id: 'appraisal',
    title: 'Set Up an Appraisal Cycle',
    tagline: 'Create a template first, then launch a cycle for your team.',
    icon: <Trophy className="w-4 h-4" />,
    steps: [
      {
        title: 'Create an Appraisal Template',
        description: 'Templates define the criteria and structure used to evaluate employees.',
        buttonLabel: 'Go to Templates',
        href: 'hrmanagement/appraisal/templates',
      },
      {
        title: 'Launch an Appraisal Cycle',
        description: 'Create a cycle and assign the template to a group of employees.',
        buttonLabel: 'Go to Cycles',
        href: 'hrmanagement/appraisal/cycles',
      },
      {
        title: 'Track Appraisal Progress',
        description: 'Monitor submissions and review results as the cycle runs.',
        buttonLabel: 'Go to Appraisals',
        href: 'appraisal',
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'Set Up Smart Scheduling',
    tagline: 'Plan work schedules, shifts and coordinate your team efficiently.',
    icon: <CalendarCheck className="w-4 h-4" />,
    steps: [
      {
        title: 'Create a Branch',
        description: 'Shifts are tied to branches. Make sure at least one branch exists.',
        buttonLabel: 'Go to Branches',
        href: 'hrmanagement/branches',
      },
      {
        title: 'Build Your Schedule',
        description: 'Create and assign shifts to employees across your branches.',
        buttonLabel: 'Go to Scheduling',
        href: 'scheduling',
      },
    ],
  },
];

function StepsModal({
  workflow,
  onClose,
  onBack,
  tenantSlug,
}: {
  workflow: Workflow;
  onClose: () => void;
  onBack: () => void;
  tenantSlug: string;
}) {
  const router = useRouter();

  const navigate = (href: string) => {
    onClose();
    router.push(`/${tenantSlug}/hr/${href}`);
  };

  return (
    <Modal isOpen onClose={onClose} title={workflow.title} width="max-w-xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-(--text-hover-muted,var(--color-gray-600)) transition-colors mt-1 mb-4"
      >
        ← Back to guides
      </button>

      <p className="text-sm text-gray-500 mb-5">{workflow.tagline}</p>

      <ol className="space-y-2.5">
        {workflow.steps.map((step, i) => (
          <li
            key={i}
            className="flex items-start gap-3.5 p-3.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              {i + 1}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-800 leading-snug">{step.title}</p>
                <button
                  onClick={() => navigate(step.href)}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600 border border-orange-200 hover:border-orange-300 bg-orange-50 hover:bg-orange-100 rounded-md px-3 py-1.5 transition-colors"
                >
                  {step.buttonLabel}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  );
}

export function HelpCenter() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showBeacon, setShowBeacon] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!dropdownOpen) return;
    const updatePos = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [dropdownOpen]);

  const tenantSlug = user?.tenantSlug || pathname.split('/')[1];
  const isEmployee = user?.role === 'EMPLOYEE';

  useEffect(() => {
    if (!user?.id) return;

    let record = getRecord(user.id);
    const isFirstVisit = !record;

    if (isFirstVisit) {
      record = { seen: false, firstSeenAt: Date.now() };
      saveRecord(user.id, record);
    }

    const beacon = shouldShowBeacon(record);

    queueMicrotask(() => {
      setShowBeacon(beacon);
      if (isFirstVisit) setDropdownOpen(true);
    });
  }, [user?.id]);

  const handleSelectWorkflow = (workflow: Workflow) => {
    setDropdownOpen(false);
    setSelectedWorkflow(workflow);

    if (user?.id) {
      const record = getRecord(user.id);
      if (record && !record.seen) {
        saveRecord(user.id, { ...record, seen: true });
        setShowBeacon(false);
      }
    }
  };

  const handleBack = () => {
    setSelectedWorkflow(null);
    setDropdownOpen(true);
  };

  const handleClose = () => {
    setSelectedWorkflow(null);
    setDropdownOpen(false);
  };

  return (
    <>
      <div className="relative inline-flex items-center" ref={anchorRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={cn(
            'inline-flex items-center text-(--topnav-icon-text,var(--module-btn-bg,var(--color-brand))) hover:text-(--topnav-icon-hover,var(--module-btn-bg-hover,var(--color-brand-hover))) transition-colors',
            dropdownOpen &&
              'text-(--topnav-icon-hover,var(--module-btn-bg-hover,var(--color-brand-hover)))',
          )}
          aria-label="Help"
        >
          <span className="relative inline-flex items-center justify-center w-5 h-5">
            {showBeacon && (
              <MessageCircleQuestion className="w-5 h-5 absolute inset-0 animate-ping text-orange-400 opacity-75" />
            )}
            <MessageCircleQuestion className="w-5 h-5 relative" />
          </span>
        </button>

        {dropdownOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div
                style={{
                  position: 'fixed',
                  top: dropdownPos.top,
                  right: dropdownPos.right,
                  width: 288,
                }}
                className="z-20 bg-white border border-gray-100 rounded-input shadow-lg overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Guides
                  </p>
                </div>
                {isEmployee ? (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (user?.id) {
                        const record = getRecord(user.id);
                        if (record && !record.seen) {
                          saveRecord(user.id, { ...record, seen: true });
                          setShowBeacon(false);
                        }
                      }
                      router.push(`/${tenantSlug}/hr/profile`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-(--surface-hover-subtle,var(--color-gray-50)) transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Complete Your Profile</p>
                      <p className="text-xs text-gray-400 truncate">
                        Update your personal details and profile photo.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                ) : (
                  WORKFLOWS.map((workflow) => (
                    <button
                      key={workflow.id}
                      onClick={() => handleSelectWorkflow(workflow)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-(--surface-hover-subtle,var(--color-gray-50)) transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                        {workflow.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{workflow.title}</p>
                        <p className="text-xs text-gray-400 truncate">{workflow.tagline}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </>,
            document.body,
          )}
      </div>

      {selectedWorkflow && (
        <StepsModal
          workflow={selectedWorkflow}
          onClose={handleClose}
          onBack={handleBack}
          tenantSlug={tenantSlug}
        />
      )}
    </>
  );
}
