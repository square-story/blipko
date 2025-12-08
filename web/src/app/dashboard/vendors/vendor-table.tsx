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
import { DataTable } from "@/components/data-table/data-table";
import { columns } from "./_components/columns";
import { VendorTableToolbar } from "./_components/vendor-table-toolbar";
import { VendorData } from "./_components/schema";

import { VendorTableFloatingBar } from "./_components/vendor-table-floating-bar";

interface VendorTableProps {
    data: VendorData[];
    pageCount: number;
    total: number;
}

export function VendorTable({ data, pageCount, total }: VendorTableProps) {
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
    const [status, setStatus] = useQueryState(
        "status",
        parseAsString.withOptions({ shallow: false })
    );
    const [category, setCategory] = useQueryState(
        "category",
        parseAsString.withOptions({ shallow: false })
    );
    const [perPage, setPerPage] = useQueryState(
        "perPage",
        parseAsInteger.withDefault(10).withOptions({ shallow: false })
    );

    // Memoize column filters from URL
    const columnFilters = React.useMemo<ColumnFiltersState>(() => {
        const filters: ColumnFiltersState = [];
        if (status) filters.push({ id: "status", value: status.split(".") });
        if (category) filters.push({ id: "category", value: category.split(".") });
        return filters;
    }, [status, category]);

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

        // Handle Status Filter
        const statusFilter = newFilters.find((f) => f.id === "status");
        if (statusFilter && Array.isArray(statusFilter.value)) {
            setStatus(statusFilter.value.join("."));
        } else {
            setStatus(null);
        }

        // Handle Category Filter
        const categoryFilter = newFilters.find((f) => f.id === "category");
        if (categoryFilter && Array.isArray(categoryFilter.value)) {
            setCategory(categoryFilter.value.join("."));
        } else {
            setCategory(null);
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
            actionBar={<VendorTableFloatingBar table={table} />}
        >
            <VendorTableToolbar table={table} />
        </DataTable>
    );
}
export type { VendorData };

