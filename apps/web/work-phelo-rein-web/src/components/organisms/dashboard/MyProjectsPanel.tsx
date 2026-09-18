'use client';

import { useMemo, useState } from 'react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useMyTasks, useUpdateTaskStatus } from '@/hooks';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import type { MyTask, TaskStatus } from '@/types/hr';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
}

const STATUS_DOT: Record<string, string> = {
  TODO: 'bg-gray-400',
  IN_PROGRESS: 'bg-blue-500',
  ON_HOLD: 'bg-red-400',
};

function TaskRow({
  task,
  onProgress,
  isProgressing,
}: {
  task: MyTask;
  onProgress: (taskId: string, next: TaskStatus) => void;
  isProgressing: boolean;
}) {
  const isTodo = task.status === 'TODO';
  const isInProgress = task.status === 'IN_PROGRESS';
  const isOnHold = task.status === 'ON_HOLD';
  const showAction = isTodo || isInProgress || isOnHold;

  const actionLabel = isTodo ? 'Start' : isInProgress ? 'Mark as completed' : '';
  const nextStatus: TaskStatus = isTodo || isOnHold ? 'IN_PROGRESS' : 'DONE';

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0 mt-0.5',
          STATUS_DOT[task.status] ?? 'bg-gray-300',
        )}
      />
      <p className="text-sm text-gray-800 flex-1 min-w-0 truncate">{task.name}</p>
      {showAction && (
        <button
          disabled={isProgressing}
          onClick={() => onProgress(task.id, nextStatus)}
          className={cn(
            'shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors',
            isInProgress
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-brand/10 text-brand hover:bg-brand/20',
            isProgressing && 'opacity-50 cursor-not-allowed',
          )}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ProjectGroup {
  id: string;
  name: string;
  status: string;
  tasks: MyTask[];
}

function ProjectRow({
  group,
  tenantSlug,
  onProgress,
  isProgressing,
}: {
  group: ProjectGroup;
  tenantSlug: string;
  onProgress: (taskId: string, next: TaskStatus) => void;
  isProgressing: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const router = useRouter();

  const incompleteTasks = group.tasks.filter((t) => t.status !== 'DONE');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="flex-1 text-sm font-semibold text-gray-900 truncate">{group.name}</span>
        <span className="shrink-0 text-[11px] font-bold text-white bg-brand rounded-full min-w-5 h-5 flex items-center justify-center px-1.5">
          {incompleteTasks.length}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pt-1 pb-3">
          <div className="divide-y divide-gray-100">
            {group.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onProgress={onProgress}
                isProgressing={isProgressing}
              />
            ))}
          </div>
          <button
            onClick={() => router.push(`/${tenantSlug}/hr/projects/${group.id}`)}
            className="mt-3 flex items-center gap-1 text-xs text-brand font-medium hover:underline"
          >
            Go to Project <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MyProjectsPanel({ isOpen, onClose, tenantSlug }: Props) {
  const toast = useToastStore((s) => s.addToast);
  const { data: myTasks = [], isLoading } = useMyTasks();
  const updateStatus = useUpdateTaskStatus();

  const projectGroups = useMemo<ProjectGroup[]>(() => {
    const map = new Map<string, ProjectGroup>();
    for (const task of myTasks) {
      if (task.status === 'DONE') continue;
      if (!map.has(task.project.id)) {
        map.set(task.project.id, {
          id: task.project.id,
          name: task.project.name,
          status: task.project.status,
          tasks: [],
        });
      }
      map.get(task.project.id)!.tasks.push(task);
    }
    return Array.from(map.values());
  }, [myTasks]);

  const handleProgress = async (taskId: string, status: TaskStatus) => {
    try {
      await updateStatus.mutateAsync({ taskId, status });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="My Projects"
      description="Your active tasks across assigned projects."
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : projectGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-sm font-medium text-gray-900">All caught up!</p>
          <p className="text-xs text-gray-400">You have no pending tasks assigned to you.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projectGroups.map((group) => (
            <ProjectRow
              key={group.id}
              group={group}
              tenantSlug={tenantSlug}
              onProgress={handleProgress}
              isProgressing={updateStatus.isPending}
            />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
