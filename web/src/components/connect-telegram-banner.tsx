"use client";

import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTelegramConnectionStatus } from "@/lib/actions/user";
import { ConnectTelegram } from "@/components/connect-telegram";

const DISMISS_KEY = "blipko:tg-banner-dismissed";

// Dismissible dashboard nudge shown to onboarded users who haven't linked
// Telegram yet — Telegram is the primary way to log spends, so surfacing it
// matters. Renders nothing while status is unknown, once connected, or dismissed.
export function ConnectTelegramBanner() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getTelegramConnectionStatus()
      .then(setConnected)
      .catch(() => setConnected(true)); // fail closed → don't nag on error
  }, []);

  if (connected !== false || dismissed) return null;

  return (
    <>
      <div className="reveal-rise flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Send className="size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Connect Telegram</p>
          <p className="truncate text-xs text-muted-foreground">
            Log spends by text like “chai 30” and get budget reminders.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => setOpen(true)}>
          Connect
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Connect Telegram</DialogTitle>
            <DialogDescription>
              Scan the code, or open Telegram on this device, then tap Start.
            </DialogDescription>
          </DialogHeader>
          <ConnectTelegram
            onConnected={() => {
              setConnected(true);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
