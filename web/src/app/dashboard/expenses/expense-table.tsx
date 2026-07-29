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
import { ExpenseData, ExpenseFilters } from "@/lib/actions/expenses";
import type { CategoryStat } from "@/lib/actions/categories";
import { DataTable } from "@/components/data-table/data-table";
import { getExpenseColumns } from "./_components/columns";
import { ExpenseTableToolbar } from "./_components/expense-table-toolbar";
import { ExpenseTableFloatingBar } from "./_components/expense-table-floating-bar";
import { DataTableAmountTotals } from "@/components/data-table/data-table-amount-totals";

interface ExpenseTableProps {
    data: ExpenseData[];
    pageCount: number;
    total: number;
    totalAmount: number;
    categoryOptions: { label: string; value: string }[];
    categories: CategoryStat[];
    // Pins the table to one category (the /categories/[id] detail page). The
    // category is then fixed context, not a filter: it stays out of the URL and
    // its column is hidden, but exports stay scoped to it.
    lockedCategoryId?: string;
}

export function ExpenseTable({
    data,
    pageCount,
    total,
    totalAmount,
    categoryOptions,
    categories,
    lockedCategoryId,
}: ExpenseTableProps) {
    const columns = React.useMemo(
        () => getExpenseColumns(categories),
        [categories],
    );
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
    const [bucket, setBucket] = useQueryState(
        "bucket",
        parseAsString.withOptions({ shallow: false })
    );
    const [categoryId, setCategoryId] = useQueryState(
        "categoryId",
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
        if (bucket) filters.push({ id: "bucket", value: bucket.split(".") });
        if (categoryId && !lockedCategoryId)
            filters.push({ id: "categoryName", value: categoryId.split(".") });
        if (from || to) {
            filters.push({
                id: "date",
                value: [from ? Number(from) : undefined, to ? Number(to) : undefined],
            });
        }
        return filters;
    }, [bucket, categoryId, from, to, lockedCategoryId]);

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

        // The filtered set changes size, so the current page can fall out of range.
        setPage(1);

        const bucketFilter = newFilters.find((f) => f.id === "bucket");
        if (bucketFilter && Array.isArray(bucketFilter.value)) {
            setBucket(bucketFilter.value.join("."));
        } else {
            setBucket(null);
        }

        if (!lockedCategoryId) {
            const categoryFilter = newFilters.find((f) => f.id === "categoryName");
            if (categoryFilter && Array.isArray(categoryFilter.value)) {
                setCategoryId(categoryFilter.value.join("."));
            } else {
                setCategoryId(null);
            }
        }

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

    const onGlobalFilterChange = (updater: Updater<string>) => {
        const newVal = typeof updater === "function" ? updater(search) : updater;
        setSearch(newVal);
    };

    const currentFilters: ExpenseFilters = {
        search: search || undefined,
        bucket: bucket || undefined,
        categoryId: lockedCategoryId ?? categoryId ?? undefined,
        from: from || undefined,
        to: to || undefined,
    };

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        // Every row shares the pinned category, so the column carries no signal.
        initialState: lockedCategoryId
            ? { columnVisibility: { categoryName: false } }
            : undefined,
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
                    pageSize: perPage,
                });
                setPage(newState.pageIndex + 1);
                setPerPage(newState.pageSize);
            }
        },
    });

    const pageTotal = data.reduce((sum, e) => sum + e.amount, 0);

    return (
        <DataTable
            table={table}
            actionBar={<ExpenseTableFloatingBar table={table} />}
            paginationInfo={
                <DataTableAmountTotals
                    pageTotal={pageTotal}
                    total={total}
                    totalAmount={totalAmount}
                />
            }
        >
            <ExpenseTableToolbar table={table} categoryOptions={categoryOptions} filters={currentFilters} />
        </DataTable>
    );
}
