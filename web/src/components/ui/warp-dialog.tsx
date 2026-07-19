"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

type WarpDialogContextType = {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
};

const WarpDialogContext = React.createContext<WarpDialogContextType | null>(
  null,
);

export function useWarpDialogContext() {
  const ctx = React.useContext(WarpDialogContext);
  if (!ctx)
    throw new Error("WarpDialog components must be used inside <WarpDialog>");
  return ctx;
}

export function WarpDialog({
  open: openProp,
  onOpenChange: setOpenProp,
  ...props
}: React.ComponentProps<"div"> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [_open, _setOpen] = React.useState(false);
  const open = openProp ?? _open;

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
    },
    [setOpenProp, open],
  );

  const contextValue = React.useMemo<WarpDialogContextType>(
    () => ({ open, setOpen }),
    [open, setOpen],
  );

  return (
    <WarpDialogContext.Provider value={contextValue}>
      <div data-slot="dialog" {...props} />
    </WarpDialogContext.Provider>
  );
}

export function WarpDialogTrigger({
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";

  const { setOpen } = useWarpDialogContext();

  return (
    <Comp
      onClick={() => setOpen((prev) => !prev)}
      data-slot="dialog-trigger"
      {...props}
    />
  );
}

function WarpDialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      <WarpAnimations />
    </div>
  );
}

export function WarpDialogContent({
  children,
  className,
  onClose,
  ...props
}: React.ComponentProps<typeof motion.div> & { onClose?: () => void }) {
  const { open, setOpen } = useWarpDialogContext();

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute">
          <WarpDialogOverlay />

          <motion.div
            onClick={() => {
              onClose?.();
              setOpen(false);
            }}
            className="fixed inset-0 z-1000 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.59, 0, 0.35, 1] }}
            {...props}
          >
            <motion.div
              className={cn(
                "relative flex flex-col items-center justify-center gap-4",
                className,
              )}
              onClick={(e) => e.stopPropagation()}
              initial={{
                rotateX: -5,
                skewY: -1.5,
                scaleY: 2,
                scaleX: 0.4,
                y: 100,
              }}
              animate={{
                rotateX: 0,
                skewY: 0,
                scaleY: 1,
                scaleX: 1,
                y: 0,
                transition: {
                  duration: 0.35,
                  ease: [0.59, 0, 0.35, 1],
                  y: { type: "spring", visualDuration: 0.7, bounce: 0.2 },
                },
              }}
              exit={{
                rotateX: -5,
                skewY: -1.5,
                scaleY: 2,
                scaleX: 0.4,
                y: 100,
              }}
              transition={{ duration: 0.35, ease: [0.59, 0, 0.35, 1] }}
              style={{
                transformPerspective: 1000,
                originX: 0.5,
                originY: 0,
              }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Restrained "warp" reveal: a single soft saffron glow over the dark scrim —
// premium and minimal, not a multi-color bloom.
function WarpAnimations() {
  const enterDuration = 0.5;
  const exitDuration = 0.25;
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px] will-change-transform"
      style={{ backgroundColor: "hsl(38, 88%, 55%)" }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{
        scale: [1, 0.85, 1],
        opacity: 0.32,
        transition: {
          duration: enterDuration,
          opacity: { duration: enterDuration, ease: "easeInOut" },
          scale: {
            duration: 14,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            delay: 0.3,
          },
        },
      }}
      exit={{ opacity: 0, transition: { duration: exitDuration } }}
    />
  );
}
