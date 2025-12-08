"use client";

import * as React from "react";
import {
    getCoreRowModel,
    useReactTable,
    SortingState,
    Updater,
    ColumnFiltersState,
} from "@tanstack/react-table";
import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { TransactionData } from "@/lib/actions/transactions";
import { DataTable } from "@/components/data-table/data-table";
import { columns } from "./_components/columns";
import { TransactionTableToolbar } from "./_components/transaction-table-toolbar";

import { TransactionTableFloatingBar } from "./_components/transaction-table-floating-bar";

interface TransactionTableProps {
    data: TransactionData[];
    pageCount: number;
    total: number;
}

export function TransactionTable({
    data,
    pageCount,
    total,
}: TransactionTableProps) {
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
    const [intent, setIntent] = useQueryState(
        "intent",
        parseAsString.withOptions({ shallow: false })
    );
    const [category, setCategory] = useQueryState(
        "category",
        parseAsString.withOptions({ shallow: false })
    );
    const [from, setFrom] = useQueryState(
        "from",
        parseAsString.withOptions({ shallow: false })
    );
    const [to, setTo] = useQueryState(
        "to",
        parseAsString.withOptions({ shallow: false })
    );
    const [perPage, setPerPage] = useQueryState(
        "perPage",
        parseAsInteger.withDefault(10).withOptions({ shallow: false })
    );

    // Memoize column filters from URL
    const columnFilters = React.useMemo<ColumnFiltersState>(() => {
        const filters: ColumnFiltersState = [];
        if (intent) filters.push({ id: "intent", value: intent.split(".") });
        if (category) filters.push({ id: "category", value: category.split(".") });
        if (from || to) {
            filters.push({
                id: "date",
                value: [from ? Number(from) : undefined, to ? Number(to) : undefined],
            });
        }
        return filters;
    }, [intent, category, from, to]);

    // Derive table sorting state
    const sorting: SortingState = React.useMemo(() => {
        if (!sort) return [];
        const [id, desc] = sort.split(".");
        return [{ id, desc: desc === "desc" }];
    }, [sort]);

    const onSortingChange = (updater: Updater<SortingState>) => {
        const newSorting =
            typeof updater === "function" ? updater(sorting) : updater;
        if (newSorting.length > 0) {
            const { id, desc } = newSorting[0];
            setSort(`${id}.${desc ? "desc" : "asc"}`);
        } else {
            setSort(null);
        }
    };

    const onColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
        const newFilters =
            typeof updater === "function" ? updater(columnFilters) : updater;

        // Handle Intent Filter
        const intentFilter = newFilters.find((f) => f.id === "intent");
        if (intentFilter && Array.isArray(intentFilter.value)) {
            setIntent(intentFilter.value.join("."));
        } else {
            setIntent(null);
        }

        // Handle Category Filter
        const categoryFilter = newFilters.find((f) => f.id === "category");
        if (categoryFilter && Array.isArray(categoryFilter.value)) {
            setCategory(categoryFilter.value.join("."));
        } else {
            setCategory(null);
        }

        // Handle Date Filter
        const dateFilter = newFilters.find((f) => f.id === "date");
        if (dateFilter && Array.isArray(dateFilter.value)) {
            const [start, end] = dateFilter.value as (number | undefined)[];
            setFrom(start ? String(start) : null);
            setTo(end ? String(end) : null);
        } else {
            setFrom(null);
            setTo(null);
        }
    };

    const onGlobalFilterChange = (updater: Updater<any>) => {
        const newVal = typeof updater === "function" ? updater(search) : updater;
        setSearch(newVal);
    }

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount,
        state: {
            sorting,
            columnFilters,
            pagination: {
                pageIndex: page - 1,
                pageSize: perPage,
            },
            globalFilter: search,
        },
        onSortingChange,
        onColumnFiltersChange,
        onGlobalFilterChange,
        onPaginationChange: (updater) => {
            if (typeof updater === "function") {
                const newState = updater({
                    pageIndex: page - 1,
                    pageSize: perPage
                });
                setPage(newState.pageIndex + 1);
                setPerPage(newState.pageSize);
            }
        }
    });



    return (
        <DataTable
            table={table}
            actionBar={<TransactionTableFloatingBar table={table} />}
        >
            <TransactionTableToolbar table={table} />
        </DataTable>
    );
}
