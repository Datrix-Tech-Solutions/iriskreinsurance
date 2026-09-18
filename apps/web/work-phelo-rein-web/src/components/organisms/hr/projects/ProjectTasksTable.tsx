'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { CreateTaskPanel } from '@/components/organisms/hr/projects/CreateTaskPanel';
import { EditTaskPanel } from '@/components/organisms/hr/projects/EditTaskPanel';
import type { ProjectTask, TaskStatus } from '@/types/hr';
import {
  useProjectTasks,
  useCreateProjectTask,
  useUpdateProjectTask,
  useProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

const STATUS_META: Record<TaskStatus, { dot: string; label: string; text: string }> = {
  TODO: { dot: 'bg-gray-400', label: 'To Do', text: 'text-gray-600' },
  IN_PROGRESS: { dot: 'bg-blue-500', label: 'In Progress', text: 'text-blue-600' },
  DONE: { dot: 'bg-green-500', label: 'Done', text: 'text-green-600' },
  ON_HOLD: { dot: 'bg-red-500', label: 'On Hold', text: 'text-red-600' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
];

function formatDue(dateStr: string) {
  const d = new Date(dateStr);
  return `Due ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const COLUMNS: Column<ProjectTask>[] = [
  {
    key: 'name',
    label: 'Task',
    width: 'minmax(200px, 1.5fr)',
    render: (row) => {
      const meta = STATUS_META[row.status];
      const isDone = row.status === 'DONE';
      return (
        <div className="flex items-start gap-3">
          <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <div>
            <p className={cn('font-medium text-gray-900', isDone && 'line-through text-gray-400')}>
              {row.name}
            </p>
            {row.dueDate && (
              <p className="text-xs text-gray-400 mt-0.5">{formatDue(row.dueDate)}</p>
            )}
          </div>
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '160px',
    render: (row) => {
      const meta = STATUS_META[row.status];
      return (
        <div className="flex items-center gap-1.5">
          <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot)} />
          <span className={cn('text-sm font-medium', meta.text)}>{meta.label}</span>
        </div>
      );
    },
  },
  {
    key: 'assignedEmployeeName',
    label: 'Assigned To',
    width: '200px',
    render: (row) =>
      row.assignedEmployeeName ? (
        <span>{row.assignedEmployeeName}</span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
];

interface Props {
  projectId: string;
}

export function ProjectTasksTable({ projectId }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskReadOnly, setTaskReadOnly] = useState(false);

  const canManageProjects = usePermission(Permission.CREATE_PROJECT_TASK);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );
  const canModify = canManageProjects || isProjectManager;

  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const matchesStatus = !statusFilter || t.status === statusFilter;
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.assignedEmployeeName?.toLowerCase().includes(q) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [tasks, search, statusFilter]);

  const handleCreate = async (values: {
    name: string;
    dueDate: string;
    status: 'TODO';
    assignedEmployeeId?: string;
  }) => {
    try {
      await createTask.mutateAsync({
        projectId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          assignedEmployeeId: values.assignedEmployeeId,
        },
      });
      setCreateOpen(false);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  const handleSave = async (
    taskId: string,
    values: { name: string; dueDate: string; status: TaskStatus; assignedEmployeeId?: string },
  ) => {
    try {
      await updateTask.mutateAsync({
        projectId,
        taskId,
        data: {
          name: values.name,
          dueDate: values.dueDate || undefined,
          status: values.status,
          assignedEmployeeId: values.assignedEmployeeId,
        },
      });
      setSelectedTask(null);
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
    }
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={filtered}
        isLoading={isLoading}
        noInternalScroll
        searchPlaceholder="Search tasks or assignee…"
        searchValue={search}
        onSearch={setSearch}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={setStatusFilter}
        actionButton={
          canModify ? { label: 'Create Task', onClick: () => setCreateOpen(true) } : undefined
        }
        onRowClick={(task) => {
          setSelectedTask(task);
          setTaskReadOnly(!canModify);
        }}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        emptyMessage="No tasks found"
      />

      {canModify && (
        <CreateTaskPanel
          projectId={projectId}
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
          isCreating={createTask.isPending}
        />
      )}

      <EditTaskPanel
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => {
          setSelectedTask(null);
          setTaskReadOnly(false);
        }}
        onSave={handleSave}
        isSaving={updateTask.isPending}
        readOnly={taskReadOnly}
      />
    </>
  );
}
