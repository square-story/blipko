"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getUnseenChangelog,
  markChangelogSeen,
  type ChangelogNotice,
} from "@/lib/actions/user";
import { formatDate } from "@/lib/format";

/**
 * Fetched client-side rather than from the dashboard layout, because three
 * pages that render <ContentLayout> (categories, recurring, boxes) are
 * "use client" — so this component sits inside a client tree and can't be async
 * or read the filesystem.
 *
 * Renders nothing at all unless there's something unseen: the header already
 * has three controls, and a permanent bell that says "nothing here" 90% of the
 * time is clutter. /changelog is the archive; this is just the notification.
 */
export function WhatsNew() {
  const [unread, setUnread] = useState(0);
  const [entries, setEntries] = useState<ChangelogNotice[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getUnseenChangelog()
      .then((result) => {
        if (!active) return;
        setUnread(result.unread);
        setEntries(result.entries);
      })
      .catch(() => {
        // Non-critical: leave the indicator hidden.
      });
    return () => {
      active = false;
    };
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Marked on close, not open, so the trigger doesn't disappear from under an
    // open dialog.
    if (!next && unread > 0) {
      setUnread(0);
      void markChangelogSeen();
    }
  }

  if (unread === 0 && !open) return null;

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider disableHoverableContent>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <ResponsiveModalTrigger asChild>
              <Button
                className="relative rounded-full w-8 h-8 bg-background"
                variant="outline"
                size="icon"
              >
                <Sparkles className="w-[1.2rem] h-[1.2rem]" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
                )}
                <span className="sr-only">What&apos;s new</span>
              </Button>
            </ResponsiveModalTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">What&apos;s new</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>What&apos;s new</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            The latest Blipko releases.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="divide-y">
          {entries.map((entry) => (
            <Link
              key={entry.slug}
              href={`/changelog/${entry.slug}`}
              className="block py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{entry.title}</p>
                {entry.unseen && <Badge variant="secondary">New</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(entry.date, { timeZone: "UTC" })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.summary}
              </p>
            </Link>
          ))}
        </div>

        <Link
          href="/changelog"
          className="mt-2 inline-block text-sm text-muted-foreground underline hover:text-foreground"
        >
          View all changes
        </Link>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
