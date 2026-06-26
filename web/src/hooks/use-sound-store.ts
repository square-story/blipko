import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type SoundStore = {
  // Whether interaction sounds play. On by default; the SoundProvider flips this
  // off on first load if the OS prefers reduced motion and the user hasn't chosen.
  enabled: boolean;
  // True once the user has explicitly toggled, so we don't override their choice.
  userSet: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useSoundStore = create(
  persist<SoundStore>(
    (set) => ({
      enabled: true,
      userSet: false,
      setEnabled: (enabled: boolean) => set({ enabled, userSet: true }),
    }),
    {
      name: "sound-settings",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
