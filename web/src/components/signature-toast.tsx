"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { toast as sonner } from "sonner";
import { cn } from "@/lib/utils";

export type SignatureToastOptions = {
  description?: ReactNode;
  onDismiss?: () => void;
  /** Skip the built-in sound (e.g. when the caller already plays one). */
  silent?: boolean;
};

// Branded Blipko toast: logo mark + primary accent bar on the popover surface.
// Rendered via sonner's toast.custom() so we own the whole card.
export function renderSignatureToast(
  id: string | number,
  title: ReactNode,
  opts?: SignatureToastOptions,
) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--radius)]",
        "border border-border bg-popover py-3 pl-4 pr-3 text-popover-foreground shadow-lg",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary before:content-['']",
      )}
    >
      <Image
        src="/icons/icon-512.png"
        alt=""
        width={20}
        height={20}
        className="shrink-0 rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold leading-tight">{title}</span>
        {opts?.description ? (
          <span className="mt-0.5 text-xs leading-tight text-muted-foreground">
            {opts.description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sonner.dismiss(id);
          opts?.onDismiss?.();
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-150 ease-[var(--ease-out)] hover:text-foreground active:scale-[0.97]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
