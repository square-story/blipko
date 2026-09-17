import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type PrivacyStore = {
  // Blurs every money figure in the dashboard so it can be used in public.
  // Read path is CSS (`html[data-privacy="on"]`), not this store — half the
  // money surfaces are Server Components a hook cannot reach. This only holds
  // the write side for the three toggle surfaces.
  on: boolean;
  setOn: (on: boolean) => void;
};

export const usePrivacyStore = create(
  persist<PrivacyStore>(
    (set) => ({
      on: false,
      setOn: (on: boolean) => set({ on }),
    }),
    {
      name: "privacy-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
