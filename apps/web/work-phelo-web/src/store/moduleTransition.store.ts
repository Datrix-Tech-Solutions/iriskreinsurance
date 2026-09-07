import { create } from 'zustand';

interface ModuleTransitionParams {
  moduleKey: string;
  moduleName: string;
  originPath: string;
}

interface ModuleTransitionStore {
  isActive: boolean;
  moduleKey: string | null;
  moduleName: string | null;
  originPath: string | null;
  start: (params: ModuleTransitionParams) => void;
  finish: () => void;
}

export const useModuleTransitionStore = create<ModuleTransitionStore>((set) => ({
  isActive: false,
  moduleKey: null,
  moduleName: null,
  originPath: null,

  start: ({ moduleKey, moduleName, originPath }) =>
    set({ isActive: true, moduleKey, moduleName, originPath }),

  finish: () => set({ isActive: false, moduleKey: null, moduleName: null, originPath: null }),
}));
