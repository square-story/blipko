"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/lib/actions/user";
import { DELETE_PHRASE, isDeleteConfirmed } from "@/lib/delete-confirm";
import { toast } from "@/lib/toast";

// Everything that cascades from the User row. Keep in step with
// prisma/schema.prisma — this is what the user is told disappears.
const DELETED = [
    "Every expense and income you've logged, including the text of voice notes.",
    "Your categories, their monthly limits, and the phrases Blipko learned to file automatically.",
    "Budget settings: income, payday, your Needs/Wants/Savings split and reminder frequency.",
    "Boxes (savings goals) and every amount moved in or out of them.",
    "Recurring income and expenses.",
    "Your chat history with the bot, and the raw text of every message it read.",
    "Pending assistant suggestions, reminder history, cycle reports and clarity ratings.",
    "The link to your Telegram chat and your Google sign-in on Blipko.",
];

const NOT_AFFECTED = [
    "Messages already in your Telegram app. Delete the chat in Telegram if you want those gone too.",
    "Your Google account itself. Only Blipko's connection to it is removed.",
];

export function DeleteAccountDialog({
    email,
    onExport,
    isExporting,
}: {
    email: string | null;
    onExport: () => void;
    isExporting: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [isDeleting, startDelete] = useTransition();
    const confirmed = isDeleteConfirmed(typed, email);

    // Success signs out and redirects home, so only a failure comes back.
    const handleDelete = () =>
        startDelete(async () => {
            const res = await deleteMyAccount(typed);
            if (res && !res.success) {
                toast.error(res.message ?? "Failed to delete account");
            }
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (isDeleting) return;
                setOpen(next);
                if (!next) setTyped("");
            }}
        >
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <Trash2 className="size-4" />
                    Delete account
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Delete your account?</DialogTitle>
                    <DialogDescription>
                        This can&apos;t be undone. There is no grace period and
                        no backup copy is kept.
                    </DialogDescription>
                </DialogHeader>

                <div className="-mx-6 max-h-[45vh] space-y-4 overflow-y-auto border-y px-6 py-4 text-sm">
                    <section className="space-y-2">
                        <h3 className="font-medium">Deleted permanently</h3>
                        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                            {DELETED.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>
                    <section className="space-y-2">
                        <h3 className="font-medium">Not affected</h3>
                        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                            {NOT_AFFECTED.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>
                    <section className="space-y-2">
                        <h3 className="font-medium">Want a copy first?</h3>
                        <p className="text-muted-foreground">
                            Download everything as a file before you delete.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onExport}
                            disabled={isExporting}
                        >
                            <Download className="size-4" />
                            {isExporting ? "Exporting…" : "Export my data"}
                        </Button>
                    </section>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="block leading-relaxed">
                        To confirm, type{" "}
                        {email ? (
                            <>
                                your email <span className="font-semibold">{email}</span> or{" "}
                            </>
                        ) : null}
                        <span className="font-semibold">{DELETE_PHRASE}</span>
                    </Label>
                    <Input
                        id="delete-confirm"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        disabled={isDeleting}
                    />
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isDeleting}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={!confirmed || isDeleting}
                    >
                        {isDeleting ? "Deleting…" : "Delete everything"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
