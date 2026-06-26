// Thin wrapper over sonner that plays a crisp sound alongside the toast, so all
// success/error/info feedback is audible from one place. Import `toast` from
// here instead of "sonner".
import { toast as sonner } from "sonner";
import { playSound } from "@/lib/sound";

type ToastArgs = Parameters<typeof sonner>;

export const toast = Object.assign(
  (...args: ToastArgs) => {
    playSound("arrival");
    return sonner(...args);
  },
  {
    ...sonner,
    success: (...args: Parameters<typeof sonner.success>) => {
      playSound("success");
      return sonner.success(...args);
    },
    error: (...args: Parameters<typeof sonner.error>) => {
      playSound("error");
      return sonner.error(...args);
    },
    info: (...args: Parameters<typeof sonner.info>) => {
      playSound("arrival");
      return sonner.info(...args);
    },
  },
);
