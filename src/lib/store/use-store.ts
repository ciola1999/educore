import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../db/schema'; // Pastikan path ini benar ke schema kamu

// Kita ambil tipe User dari DB, tapi buang passwordHash demi keamanan
export type UserSession = Omit<User, 'passwordHash'>;

interface AppState {
  // Session
  user: UserSession | null;
  isAuthenticated: boolean; // Helper flag untuk cek login
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
      // Auth State
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),

      // Sync State
      isSyncing: false,
      lastSync: null,
      setSyncStatus: (status) => set({ isSyncing: status }),
      setLastSync: (date) => set({ lastSync: date }),
    }),
    {
      name: 'educore-storage',
      // Kita gunakan sessionStorage agar sesi hilang jika window ditutup (lebih aman untuk sekolah)
      // Jika ingin tetap login meski browser ditutup, hapus baris 'storage' ini.
      storage: createJSONStorage(() => sessionStorage), 
      
      // Persist user & lastSync, tapi jangan persist status syncing (karena itu state sementara)
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        lastSync: state.lastSync 
      }), 
    }
  )
);