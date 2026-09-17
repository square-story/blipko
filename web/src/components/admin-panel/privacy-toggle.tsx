"use client";

import { useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrivacyStore } from "@/hooks/use-privacy-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";

/** How long a peeked figure stays readable. */
const PEEK_MS = 4000;

export function PrivacyToggle() {
  const on = usePrivacyStore((state) => state.on);
  const setOn = usePrivacyStore((state) => state.setOn);

  // The attribute is the read path for everything: one CSS rule in globals.css
  // blurs `[data-money]` under it, which reaches Server Components and portals
  // alike. A pre-paint script in dashboard/layout.tsx sets it before first paint.
  useEffect(() => {
    if (on) document.documentElement.dataset.privacy = "on";
    else delete document.documentElement.dataset.privacy;
  }, [on]);

  // Click a blurred figure to reveal just that one. One delegated listener
  // rather than state per figure — a long table has hundreds of them.
  useEffect(() => {
    if (!on) return;

    let peeked: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      if (timer) clearTimeout(timer);
      peeked?.removeAttribute("data-peek");
      peeked = null;
    };

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-money]"
      );
      if (!el) return;
      // Capture phase, and both of these: money sits inside <Link> on the
      // dashboard stat and bucket cards. preventDefault alone stops the anchor
      // but React onClick handlers further up would still fire.
      e.preventDefault();
      e.stopPropagation();
      clear();
      peeked = el;
      el.setAttribute("data-peek", "");
      timer = setTimeout(clear, PEEK_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, [on]);

  return (
    <TooltipProvider disableHoverableContent>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Button
            className="rounded-full w-8 h-8 bg-background mr-2"
            variant="outline"
            size="icon"
            onClick={() => setOn(!on)}
          >
            {/* Swapped by the `privacy:` variant, not by state, so the button
                renders identically on the server and after hydration. */}
            <Eye className="w-[1.2rem] h-[1.2rem] scale-100 transition-transform ease-in-out duration-500 privacy:scale-0" />
            <EyeOff className="absolute w-[1.2rem] h-[1.2rem] scale-0 transition-transform ease-in-out duration-500 privacy:scale-100" />
            <span className="sr-only">Toggle privacy mode</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {on ? "Show amounts" : "Hide amounts"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
