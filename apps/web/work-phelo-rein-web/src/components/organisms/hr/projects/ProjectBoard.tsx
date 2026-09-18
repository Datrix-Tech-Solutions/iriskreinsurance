'use client';

import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TaskStatus, ProjectTask } from '@/types/hr';
import {
  useProjectTasks,
  useUpdateTaskStatus,
  useProject,
  useMyProfile,
  usePermission,
} from '@/hooks';
import { Permission } from '@/lib/permissionMap';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';
import { cardClass, cn } from '@/lib/utils';

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'TODO', label: 'TO DO', color: 'bg-gray-400' },
  { key: 'IN_PROGRESS', label: 'IN PROGRESS', color: 'bg-blue-500' },
  { key: 'ON_HOLD', label: 'ON HOLD', color: 'bg-amber-500' },
  { key: 'DONE', label: 'DONE', color: 'bg-green-500' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function TaskCard({
  task,
  canMove,
  isDragging = false,
}: {
  task: ProjectTask;
  canMove: boolean;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    disabled: !canMove,
    data: { task },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canMove ? listeners : {})}
      {...(canMove ? attributes : {})}
      className={cardClass(
        cn(
          'p-3 flex flex-col gap-3 transition-opacity touch-none',
          canMove && 'cursor-grab active:cursor-grabbing',
          isDragging ? 'opacity-40' : 'opacity-100',
        ),
      )}
    >
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug flex-1">{task.name}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignedEmployeeName ? (
            <>
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-brand">
                  {getInitials(task.assignedEmployeeName)}
                </span>
              </div>
              <span className="text-xs text-gray-600 truncate">{task.assignedEmployeeName}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskCardOverlay({ task }: { task: ProjectTask }) {
  return (
    <div
      className={cardClass('p-3 flex flex-col gap-3 shadow-xl rotate-2 opacity-95 border-brand/40')}
    >
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug flex-1">{task.name}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {task.assignedEmployeeName ? (
            <>
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-brand">
                  {getInitials(task.assignedEmployeeName)}
                </span>
              </div>
              <span className="text-xs text-gray-600 truncate">{task.assignedEmployeeName}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400">Unassigned</span>
          )}
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{formatDate(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  tasks,
  canMove,
  activeId,
}: {
  col: (typeof COLUMNS)[number];
  tasks: ProjectTask[];
  canMove: boolean;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-3 min-w-60 flex-1 rounded-xl p-3 transition-colors ${
        isOver ? 'bg-brand/5 ring-2 ring-brand/20' : 'bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`w-2 h-2 rounded-full ${col.color}`} />
        <span className="text-xs font-bold tracking-wide text-gray-600">{col.label}</span>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 min-h-16">
        {tasks.length === 0 ? (
          <div
            className={`flex-1 rounded-lg border-2 border-dashed text-center py-8 text-xs transition-colors ${
              isOver ? 'border-brand/40 text-brand/60' : 'border-gray-200 text-gray-400'
            }`}
          >
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canMove={canMove}
              isDragging={activeId === task.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
}

export function ProjectBoard({ projectId }: Props) {
  const toast = useToastStore((s) => s.addToast);

  const canManageProjects = usePermission(Permission.UPDATE_PROJECT_TASK);
  const { data: myProfile } = useMyProfile();
  const { data: project } = useProject(projectId);
  const isProjectManager = !!(
    project?.managerId &&
    myProfile?.id &&
    project.managerId === myProfile.id
  );

  const { data: tasks = [], isLoading } = useProjectTasks(projectId);
  const updateStatus = useUpdateTaskStatus();

  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  // optimistic overrides: taskId → column status
  const [optimistic, setOptimistic] = useState<Record<string, TaskStatus>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const canMoveTask = (task: ProjectTask) =>
    canManageProjects || isProjectManager || task.assignedEmployeeId === myProfile?.id;

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, ProjectTask[]> = {
      TODO: [],
      IN_PROGRESS: [],
      ON_HOLD: [],
      DONE: [],
    };
    for (const task of tasks) {
      const status = optimistic[task.id] ?? task.status;
      map[status].push(task);
    }
    return map;
  }, [tasks, optimistic]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || !active) return;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const currentStatus = optimistic[task.id] ?? task.status;
    if (newStatus !== currentStatus && COLUMNS.some((c) => c.key === newStatus)) {
      setOptimistic((prev) => ({ ...prev, [task.id]: newStatus }));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveTask(null);

    if (!over) {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[active.id as string];
        return next;
      });
      return;
    }

    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || !COLUMNS.some((c) => c.key === newStatus)) return;

    const originalStatus = task.status;
    if (newStatus === originalStatus && !optimistic[task.id]) return;

    try {
      await updateStatus.mutateAsync({ taskId: task.id, status: newStatus });
    } catch (err) {
      toast({ message: extractError(err), type: 'error' });
      // revert optimistic
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    } finally {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex flex-col gap-3 min-w-60 flex-1 bg-gray-50 rounded-xl p-3"
          >
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            col={col}
            tasks={grouped[col.key]}
            canMove={grouped[col.key].some(canMoveTask)}
            activeId={activeTask?.id ?? null}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
