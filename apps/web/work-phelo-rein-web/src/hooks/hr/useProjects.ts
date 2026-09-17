import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ProjectDetail,
  ProjectTask,
  ProjectMember,
  ProjectActivity,
  MyTask,
  CreateProjectDto,
  UpdateProjectDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
  AddProjectMemberDto,
  TaskStatus,
} from '@/types/hr';

const KEY = 'projects';

export function useProjects() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => {
      const res = await api.get<ProjectDetail[]>('/hr/projects');
      return res.data;
    },
  });
}

export function useMyProjects() {
  return useQuery({
    queryKey: [KEY, 'my-projects'],
    queryFn: async () => {
      const res = await api.get<ProjectDetail[]>('/hr/projects/my-projects');
      return res.data;
    },
  });
}

export function useMyTasks() {
  return useQuery({
    queryKey: [KEY, 'my-tasks'],
    queryFn: async () => {
      const res = await api.get<MyTask[]>('/hr/projects/my-tasks');
      return res.data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      const res = await api.get<ProjectDetail>(`/hr/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectDto) => {
      const res = await api.post<ProjectDetail>('/hr/projects', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectDto }) => {
      const res = await api.patch<ProjectDetail>(`/hr/projects/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [KEY, id] });
    },
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ message: string }>(`/hr/projects/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'members'],
    queryFn: async () => {
      const res = await api.get<ProjectMember[]>(`/hr/projects/${projectId}/members`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: AddProjectMemberDto }) => {
      const res = await api.post<ProjectMember>(`/hr/projects/${projectId}/members`, data);
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'members'] });
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, employeeId }: { projectId: string; employeeId: string }) => {
      const res = await api.delete<{ message: string }>(
        `/hr/projects/${projectId}/members/${employeeId}`,
      );
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'members'] });
    },
  });
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'tasks'],
    queryFn: async () => {
      const res = await api.get<ProjectTask[]>(`/hr/projects/${projectId}/tasks`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: CreateProjectTaskDto }) => {
      const res = await api.post<ProjectTask>(`/hr/projects/${projectId}/tasks`, data);
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'tasks'] });
    },
  });
}

export function useUpdateProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      taskId,
      data,
    }: {
      projectId: string;
      taskId: string;
      data: UpdateProjectTaskDto;
    }) => {
      const res = await api.patch<ProjectTask>(`/hr/projects/${projectId}/tasks/${taskId}`, data);
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'tasks'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const res = await api.patch<ProjectTask>(`/hr/projects/tasks/${taskId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, taskId }: { projectId: string; taskId: string }) => {
      const res = await api.delete<{ message: string }>(
        `/hr/projects/${projectId}/tasks/${taskId}`,
      );
      return res.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: [KEY, projectId] });
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'tasks'] });
    },
  });
}

export function useProjectActivities(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'activities'],
    queryFn: async () => {
      const res = await api.get<ProjectActivity[]>(`/hr/projects/${projectId}/activities`);
      return res.data;
    },
    enabled: !!projectId,
  });
}
