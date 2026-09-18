import { create } from 'zustand';

interface NavigationLoaderStore {
  isNavigating: boolean;
  originPath: string | null;
  start: (originPath: string) => void;
  finish: () => void;
}

export const useNavigationLoaderStore = create<NavigationLoaderStore>((set) => ({
  isNavigating: false,
  originPath: null,

  start: (originPath) => set({ isNavigating: true, originPath }),
  finish: () => set({ isNavigating: false, originPath: null }),
}));
