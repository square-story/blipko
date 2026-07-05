"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SendIcon, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateTelegramLinkToken,
  getTelegramConnectionStatus,
} from "@/lib/actions/user";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;
const MAX_POLLS = 60; // ~3 minutes, then offer a manual re-check

// One place for the "link your Telegram" UX: a scannable QR of the deep link
// (for desktop), an open-in-Telegram button, and automatic detection of the
// link (polls the connection status) so the user never has to tap "I've linked
// it". Reused by onboarding, the Account card, and the dashboard banner.
export function ConnectTelegram({
  onConnected,
  className,
}: {
  onConnected?: () => void;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onConnectedRef = useRef(onConnected);
  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setExhausted(false);
    let n = 0;
    pollRef.current = setInterval(async () => {
      n += 1;
      const ok = await getTelegramConnectionStatus().catch(() => false);
      if (ok) {
        stopPolling();
        setConnected(true);
        onConnectedRef.current?.();
      } else if (n >= MAX_POLLS) {
        stopPolling();
        setExhausted(true);
      }
    }, POLL_MS);
  }, [stopPolling]);

  useEffect(() => {
    let active = true;
    generateTelegramLinkToken()
      .then((u) => {
        if (!active) return;
        setUrl(u);
        startPolling();
      })
      .catch(() => {
        if (active) setError("Couldn't start linking — please try again.");
      });
    return () => {
      active = false;
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  // url is pre-generated, so this open() is synchronous → not popup-blocked.
  const openTelegram = () => {
    if (url) window.open(url, "_blank");
  };

  if (connected) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-4 text-sm font-medium text-green-600",
          className,
        )}
      >
        <CheckCircle2 className="size-5" /> Connected! You&apos;re all set.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {url ? (
        <div className="rounded-lg bg-white p-3">
          <QRCodeSVG value={url} size={160} />
        </div>
      ) : (
        <div className="flex h-[184px] w-[184px] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Scan with your phone, or open Telegram on this device.
      </p>
      <Button onClick={openTelegram} disabled={!url} className="w-full">
        <SendIcon className="mr-2 size-4" /> Open in Telegram
      </Button>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {exhausted ? (
          <button type="button" onClick={startPolling} className="underline">
            Not linked yet — check again
          </button>
        ) : (
          <>
            <Loader2 className="size-3 animate-spin" /> Waiting for you to tap
            Start…
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
