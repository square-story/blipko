"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    getSortedRowModel,
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

// Define the shape of our data
export type VendorData = {
    id: string;
    name: string;
    category: string;
    status: ContactStatus;
    totalSpend: number;
    lastTransaction?: Date;
    transactionCount: number;
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
                const formatted = new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                }).format(amount);
                return <div className="font-medium">{formatted}</div>;
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
            <div className="flex items-center justify-between">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vendors..."
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        className="pl-8"
                    />
                </div>
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
