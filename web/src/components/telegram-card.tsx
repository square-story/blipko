"use client";

import { useEffect, useState } from "react";
import { SendIcon } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateTelegramLinkToken, getTelegramConnectionStatus } from "@/lib/actions/user";

export function TelegramCard() {
    const [connected, setConnected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getTelegramConnectionStatus().then(setConnected);
    }, []);

    const handleConnect = async () => {
        setLoading(true);
        // Open blank window NOW (inside click handler) so browser doesn't block it as a popup
        const win = window.open("", "_blank");
        try {
            const url = await generateTelegramLinkToken();
            if (win) win.location.href = url;
            else window.location.href = url;
        } catch {
            win?.close();
        } finally {
            setLoading(false);
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
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                            ● Connected
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            Your Telegram is linked to this account.
                        </span>
                    </div>
                ) : (
                    <Button onClick={handleConnect} disabled={loading} variant="outline">
                        <SendIcon className="mr-2 size-4" />
                        {loading ? "Opening…" : "Connect Telegram"}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
