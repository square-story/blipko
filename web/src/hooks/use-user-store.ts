import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserPreferences {
  language: string;
  currency: string;
  theme: string;
}

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  preferences?: UserPreferences;
}

interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      updatePreferences: (preferences) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                preferences: {
                  ...state.user.preferences,
                  ...preferences,
                } as UserPreferences,
              }
            : null,
        })),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "user-storage",
    },
  ),
);
