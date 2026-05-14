import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PendingInvoicesListProps {
    contacts: { id: string; name: string; currentBalance: number }[];
}

export function PendingInvoicesList({ contacts }: PendingInvoicesListProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Pending Receivables</CardTitle>
                <CardDescription>Contacts who owe you money</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Amount Owed</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contacts.map((contact) => (
                            <TableRow key={contact.id}>
                                <TableCell className="font-medium">{contact.name}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">
                                    {new Intl.NumberFormat("en-IN", {
                                        style: "currency",
                                        currency: "INR",
                                    }).format(Number(contact.currentBalance))}
                                </TableCell>
                            </TableRow>
                        ))}
                        {contacts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    No pending receivables.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
