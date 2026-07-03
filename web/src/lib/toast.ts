// Thin wrapper over sonner that plays a crisp sound alongside the toast, so all
// success/error/info feedback is audible from one place. Import `toast` from
// here instead of "sonner".
import type { ReactNode } from "react";
import { toast as sonner } from "sonner";
import { playSound } from "@/lib/sound";
import {
  renderSignatureToast,
  type SignatureToastOptions,
} from "@/components/signature-toast";

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
    // Branded milestone toast — logo + primary accent. Use for creation /
    // settings-committed / onboarding moments, not routine CRUD.
    signature: (title: ReactNode, opts?: SignatureToastOptions) => {
      if (!opts?.silent) playSound("arrival");
      return sonner.custom((id) => renderSignatureToast(id, title, opts));
    },
  },
);
