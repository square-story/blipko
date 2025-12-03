"use client";

import { AnimatedNumber } from "@/components/animated-number";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
} from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
// import { ContactStatus } from "@prisma/client"; // Enum import issues

// Define local type to avoid import issues
export type ContactStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
import { VendorDialog } from "./vendor-dialog";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteVendor } from "@/lib/actions/vendors";
import { toast } from "sonner";
import { useState } from "react";
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

// Define the shape of our data
export type VendorData = {
    id: string;
    name: string;
    category: string;
    status: ContactStatus;
    totalSpend: number;
    lastTransaction?: Date;
    transactionCount: number;
    phoneNumber?: string | null;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    currentBalance: number;
};

interface VendorTableProps {
    data: VendorData[];
    pageCount: number;
    total: number;
}

export function VendorTable({ data, pageCount, total }: VendorTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL State
    const page = Number(searchParams.get("page")) || 1;
    const search = searchParams.get("search") || "";
    const sortParam = searchParams.get("sort");

    // Local State for immediate UI feedback (optional, but good for search input)
    const [searchValue, setSearchValue] = React.useState(search);

    // Sorting State
    const [sorting, setSorting] = React.useState<SortingState>(() => {
        if (sortParam) {
            const [id, desc] = sortParam.split(".");
            return [{ id, desc: desc === "desc" }];
        }
        return [];
    });

    // Debounce search
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== search) {
                updateUrl({ search: searchValue, page: 1 });
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchValue]);

    // Handle sorting change
    React.useEffect(() => {
        if (sorting.length > 0) {
            const { id, desc } = sorting[0];
            updateUrl({ sort: `${id}.${desc ? "desc" : "asc"}` });
        } else {
            updateUrl({ sort: undefined });
        }
    }, [sorting]);

    const updateUrl = (params: Record<string, string | number | undefined>) => {
        const newParams = new URLSearchParams(searchParams.toString());
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === "") {
                newParams.delete(key);
            } else {
                newParams.set(key, String(value));
            }
        });
        router.push(`?${newParams.toString()}`);
    };

    const columns: ColumnDef<VendorData>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Vendor Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "category",
            header: "Category",
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge variant={status === "ACTIVE" ? "default" : "secondary"}>
                        {status}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "totalSpend",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Total Spend
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("totalSpend"));
                return (
                    <div className="font-medium">
                        {amount.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                        })}
                    </div>
                );
            },
        },
        {
            accessorKey: "lastTransaction",
            header: "Last Transaction",
            cell: ({ row }) => {
                const date = row.getValue("lastTransaction") as Date | undefined;
                return date ? date.toLocaleDateString() : "N/A";
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const vendor = row.original;
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
            },
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        pageCount,
        state: {
            sorting,
            pagination: {
                pageIndex: page - 1,
                pageSize: 10,
            },
        },
        onSortingChange: setSorting,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-x-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vendors..."
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        className="pl-8"
                    />
                </div>
                <VendorDialog />
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    Page {page} of {pageCount} ({total} vendors)
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUrl({ page: page - 1 })}
                        disabled={page <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUrl({ page: page + 1 })}
                        disabled={page >= pageCount}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
