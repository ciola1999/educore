import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserSession = {
  id: string;
  name: string;
  role: 'admin' | 'teacher' | 'staff';
};

interface AppState {
  // Session
  user: UserSession | null;
  login: (user: UserSession) => void;
  logout: () => void;

  // Sync Status
  isSyncing: boolean;
  lastSync: Date | null;
  setSyncStatus: (status: boolean) => void;
  setLastSync: (date: Date) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),

      isSyncing: false,
      lastSync: null,
      setSyncStatus: (status) => set({ isSyncing: status }),
      setLastSync: (date) => set({ lastSync: date }),
    }),
    {
      name: 'educore-storage',
      partialize: (state) => ({ user: state.user, lastSync: state.lastSync }), // Persist minimal state
    }
  )
);
