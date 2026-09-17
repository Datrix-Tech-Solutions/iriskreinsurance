import { create } from 'zustand';
import { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  permissions: string[];
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setPermissions: (permissions: string[]) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  permissions: [],
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setPermissions: (permissions) => set({ permissions }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, permissions: [], isLoading: false }),
}));
