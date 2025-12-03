"use client";

import * as React from "react";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    Updater,
} from "@tanstack/react-table";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
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
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { TransactionData } from "@/lib/actions/transactions";
import Link from "next/link";

interface TransactionTableProps {
    data: TransactionData[];
    pageCount: number;
    total: number;
}

export function TransactionTable({ data, pageCount, total }: TransactionTableProps) {
    // URL State
    const [page, setPage] = useQueryState(
        "page",
        parseAsInteger.withDefault(1).withOptions({ shallow: false })
    );
    const [search, setSearch] = useQueryState(
        "search",
        parseAsString.withDefault("").withOptions({ shallow: false })
    );
    const [sort, setSort] = useQueryState(
        "sort",
        parseAsString.withOptions({ shallow: false })
    );

    // Local State for immediate UI feedback
    const [searchValue, setSearchValue] = React.useState(search);
    const debouncedSearch = useDebounce(searchValue, 300);

    // Derive table sorting state
    const sorting: SortingState = React.useMemo(() => {
        if (!sort) return [];
        const [id, desc] = sort.split(".");
        return [{ id, desc: desc === "desc" }];
    }, [sort]);

    // Handle table sorting change
    const onSortingChange = (updater: Updater<SortingState>) => {
        const newSorting = typeof updater === "function" ? updater(sorting) : updater;
        if (newSorting.length > 0) {
            const { id, desc } = newSorting[0];
            setSort(`${id}.${desc ? "desc" : "asc"}`);
        } else {
            setSort(null);
        }
    };

    // Sync search with URL
    React.useEffect(() => {
        if (debouncedSearch !== search) {
            setSearch(debouncedSearch || null);
            if (page !== 1) setPage(1);
        }
    }, [debouncedSearch, search, page, setSearch, setPage]);

    const columns: ColumnDef<TransactionData>[] = [
        {
            accessorKey: "date",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const date = row.getValue("date") as Date;
                return <div>{new Date(date).toLocaleDateString()}</div>;
            },
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <div className="font-medium">{row.getValue("description") || "-"}</div>,
        },
        {
            accessorKey: "contact",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Contact
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const contactName = row.original.contactName;
                const contactId = row.original.contactId;
                if (!contactName) return <span className="text-muted-foreground">-</span>;

                return contactId ? (
                    <Link href={`/dashboard/vendors/${contactId}`} className="hover:underline text-primary">
                        {contactName}
                    </Link>
                ) : (
                    <span>{contactName}</span>
                );
            },
        },
        {
            accessorKey: "category",
            header: "Category",
            cell: ({ row }) => <Badge variant="secondary">{row.getValue("category")}</Badge>,
        },
        {
            accessorKey: "amount",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="w-full justify-end"
                    >
                        Amount
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"));
                const intent = row.original.intent;
                const isCredit = intent === "CREDIT";
                const isDebit = intent === "DEBIT";

                return (
                    <div className={`font-medium text-right ${isCredit ? "text-green-600" : isDebit ? "text-red-600" : ""}`}>
                        {amount.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                        })}
                    </div>
                );
            },
        },
        {
            accessorKey: "intent",
            header: "Type",
            cell: ({ row }) => {
                const intent = row.getValue("intent") as string;
                return (
                    <Badge variant={intent === "CREDIT" ? "default" : intent === "DEBIT" ? "destructive" : "secondary"}>
                        {intent}
                    </Badge>
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
        onSortingChange: onSortingChange,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-x-2">
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search transactions..."
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
                    Page {page} of {pageCount} ({total} transactions)
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
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
