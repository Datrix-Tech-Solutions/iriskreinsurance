'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface UploadAvatarResponse {
  /** Resolved (signed) URL for immediate display. */
  avatarUrl: string;
  user?: { id: string; avatarUrl: string | null };
}

/**
 * Uploads a new avatar for the signed-in user to `POST /auth/users/me/avatar`
 * (multipart, field `file`). On success it pushes the returned signed URL into
 * the auth store (so the top-nav avatar updates at once) and invalidates the
 * profile / employee / dashboard queries so every avatar surface re-fetches.
 */
export function useUploadMyAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post<UploadAvatarResponse>('/auth/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const { user, setUser } = useAuthStore.getState();
      if (user && data.avatarUrl) setUser({ ...user, avatarUrl: data.avatarUrl });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
