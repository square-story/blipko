"use client";

import { useTransition } from "react";
import { Database, Download, Trash2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteMyAccount, exportMyData } from "@/lib/actions/user";
import { toast } from "@/lib/toast";

export function DataCard() {
    const [isExporting, startExport] = useTransition();

    const handleExport = () =>
        startExport(async () => {
            const res = await exportMyData();
            if (!res.success || !res.json) {
                toast.error(res.message ?? "Failed to export");
                return;
            }
            const blob = new Blob([res.json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `blipko-export-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

    // On success the action signs out and redirects, so only failure returns.
    const handleDelete = async () => {
        const res = await deleteMyAccount();
        if (!res.success) toast.error(res.message ?? "Failed to delete account");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="size-4 text-muted-foreground" />
                    Your data
                </CardTitle>
                <CardDescription>
                    Download everything Blipko stores about you, or delete your account.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={isExporting}
                >
                    <Download className="size-4" />
                    {isExporting ? "Exporting…" : "Export my data"}
                </Button>
                <ConfirmDialog
                    title="Delete your account?"
                    description="This permanently erases every expense, income, category, box, chat history and log. It can't be undone. Export your data first if you want a copy."
                    confirmLabel="Delete everything"
                    onConfirm={handleDelete}
                    trigger={
                        <Button variant="destructive" size="sm">
                            <Trash2 className="size-4" />
                            Delete account
                        </Button>
                    }
                />
            </CardContent>
        </Card>
    );
}
