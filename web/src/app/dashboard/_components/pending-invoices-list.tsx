"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sendWhatsAppReminder } from "@/lib/actions/dashboard";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Contact {
    id: string;
    name: string;
    currentBalance: number; // Decimal is converted to number in action
    phoneNumber: string | null;
}

interface PendingInvoicesListProps {
    contacts: any[]; // Using any to avoid complex Decimal type issues from Prisma client in client component
}

export function PendingInvoicesList({ contacts }: PendingInvoicesListProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleRemind = async (contactId: string) => {
        setLoadingId(contactId);
        try {
            const result = await sendWhatsAppReminder(contactId);
            if (result.success) {
                toast.success("Reminder sent successfully");
            } else {
                toast.error("Failed to send reminder");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pending Invoices</CardTitle>
                <CardDescription>Contacts with high negative balances</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contacts.map((contact) => (
                            <TableRow key={contact.id}>
                                <TableCell className="font-medium">{contact.name}</TableCell>
                                <TableCell className="text-right text-red-500">
                                    {new Intl.NumberFormat("en-IN", {
                                        style: "currency",
                                        currency: "INR",
                                    }).format(Number(contact.currentBalance))}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemind(contact.id)}
                                        disabled={loadingId === contact.id}
                                    >
                                        {loadingId === contact.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "WhatsApp Remind"
                                        )}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {contacts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground">
                                    No pending invoices found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
