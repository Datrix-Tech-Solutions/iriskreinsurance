import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavRailStore {
  /** Has the user opened the HR module at least once this device/session — drives
   *  whether a parked, icon-only HR rail shows up while browsing other modules. */
  hasVisitedHr: boolean;
  markHrVisited: () => void;
}

export const useNavRailStore = create<NavRailStore>()(
  persist(
    (set) => ({
      hasVisitedHr: false,
      markHrVisited: () => set({ hasVisitedHr: true }),
    }),
    { name: 'nav-rail-store' },
  ),
);
