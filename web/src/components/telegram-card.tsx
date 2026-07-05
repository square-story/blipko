"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTelegramConnectionStatus, unlinkTelegram } from "@/lib/actions/user";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConnectTelegram } from "@/components/connect-telegram";
import { toast } from "@/lib/toast";

export function TelegramCard() {
    const [connected, setConnected] = useState<boolean | null>(null);

    useEffect(() => {
        getTelegramConnectionStatus().then(setConnected);
    }, []);

    const handleUnlink = async () => {
        const res = await unlinkTelegram();
        if (res.success) {
            setConnected(false);
            toast.success("Telegram account unlinked");
        } else {
            toast.error("Failed to unlink Telegram account");
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Telegram</CardTitle>
                <CardDescription>
                    Connect your Telegram account to track payments via the Blipko bot.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {connected === null ? null : connected ? (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
                                ● Connected
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                                Your Telegram is linked to this account.
                            </span>
                        </div>
                        <ConfirmDialog
                            title="Unlink Telegram?"
                            description="You will no longer be able to log expenses via the Telegram bot until you reconnect."
                            onConfirm={handleUnlink}
                            trigger={
                                <Button variant="destructive" size="sm">
                                    Unlink
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <ConnectTelegram
                        className="mx-auto max-w-xs"
                        onConnected={() => {
                            setConnected(true);
                            toast.success("Telegram connected");
                        }}
                    />
                )}
            </CardContent>
        </Card>
    );
}
