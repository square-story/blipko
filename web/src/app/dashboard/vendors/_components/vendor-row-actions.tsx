"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Row } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { deleteVendor } from "@/lib/actions/vendors";
import { VendorDialog } from "../vendor-dialog";
import { VendorData } from "./schema";

interface VendorRowActionsProps<TData> {
    row: Row<TData>;
}

export function VendorRowActions<TData>({ row }: VendorRowActionsProps<TData>) {
    const router = useRouter();
    const vendor = row.original as VendorData;
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);

    return (
        <>
            <VendorDialog
                vendor={vendor}
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
            />
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            vendor and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                const result = await deleteVendor(vendor.id);
                                if (result.success) {
                                    toast.success(result.message);
                                } else {
                                    toast.error(result.message);
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                        onClick={() => navigator.clipboard.writeText(vendor.id)}
                    >
                        Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/vendors/${vendor.id}`)}
                    >
                        <FileText className="mr-2 h-4 w-4" />
                        View Transactions
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => setTimeout(() => setShowEditDialog(true), 0)}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => setTimeout(() => setShowDeleteAlert(true), 0)}
                        className="text-red-600"
                    >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}
