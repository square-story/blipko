"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCw, Check } from "lucide-react";
import { regenerateInviteCode } from "@/lib/actions/group";

export function GroupInviteSection({
  inviteCode,
  isAdmin,
  onRefresh,
}: {
  inviteCode: string;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const copy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const regenerate = () =>
    startTransition(async () => {
      await regenerateInviteCode();
      onRefresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Invite Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-mono font-bold tracking-widest text-center py-2 bg-muted rounded">
          {inviteCode}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Share this code in your family group. Members send it to the bot to join.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
            {copied ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={regenerate}
              disabled={isPending}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              New Code
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
