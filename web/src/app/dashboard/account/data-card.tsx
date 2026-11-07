"use client";

import { useTransition } from "react";
import { Database, Download } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { exportMyData } from "@/lib/actions/user";
import { toast } from "@/lib/toast";
import { DeleteAccountDialog } from "./delete-account-dialog";

export function DataCard({ email }: { email: string | null }) {
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
            // en-CA formats as YYYY-MM-DD in the browser's own timezone; toISOString
            // would name an IST export made before 05:30 with yesterday's date.
            a.download = `blipko-export-${new Date().toLocaleDateString("en-CA")}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

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
                <DeleteAccountDialog
                    email={email}
                    onExport={handleExport}
                    isExporting={isExporting}
                />
            </CardContent>
        </Card>
    );
}
