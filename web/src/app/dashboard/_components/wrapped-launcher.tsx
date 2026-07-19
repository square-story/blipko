"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import {
  WarpDialog,
  WarpDialogTrigger,
  WarpDialogContent,
} from "@/components/ui/warp-dialog";
import { WrappedStory } from "./wrapped-story";
import type { WrappedStats } from "@/lib/actions/wrapped";
import { Button } from "@/components/ui/button";

const SAFFRON = "#E9A23C";

export function WrappedLauncher({ stats }: { stats: WrappedStats }) {
  return (
    <WarpDialog>
      <WarpDialogTrigger asChild>

        <Button
          type="button"
          variant="outline"
          className="group h-auto w-full items-center justify-between gap-4 whitespace-normal rounded-xl border-border bg-card px-5 py-4 text-left hover:bg-accent"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0" style={{ color: SAFFRON }} />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-foreground">
                Your {stats.monthLabel} Wrapped is ready
              </span>
              <span className="text-xs text-muted-foreground">
                See where your money went — and share it.
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition group-hover:text-foreground">
            <span className="hidden sm:inline">Open</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </Button>
      </WarpDialogTrigger>
      <WarpDialogContent>
        <WrappedStory stats={stats} />
      </WarpDialogContent>
    </WarpDialog>
  );
}
