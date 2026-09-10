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
import {
  type IncomeData,
  type IncomeFilters,
  type IncomeCategoryOption,
} from "@/lib/actions/income";
import { DataTable } from "@/components/data-table/data-table";
import { getIncomeColumns } from "./_components/columns";
import { IncomeTableToolbar } from "./_components/income-table-toolbar";
import { IncomeTableFloatingBar } from "./_components/income-table-floating-bar";
import { DataTableAmountTotals } from "@/components/data-table/data-table-amount-totals";

interface IncomeTableProps {
  data: IncomeData[];
  pageCount: number;
  total: number;
  totalAmount: number;
  categories: IncomeCategoryOption[];
  categoryOptions: { label: string; value: string }[];
}

export function IncomeTable({
  data,
  pageCount,
  total,
  totalAmount,
  categories,
  categoryOptions,
}: IncomeTableProps) {
  const columns = React.useMemo(
    () => getIncomeColumns(categories),
    [categories],
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsString.withOptions({ shallow: false }),
  );
  const [from, setFrom] = useQueryState(
    "from",
    parseAsString.withOptions({ shallow: false }),
  );
  const [to, setTo] = useQueryState(
    "to",
    parseAsString.withOptions({ shallow: false }),
  );
  const [perPage, setPerPage] = useQueryState(
    "perPage",
    parseAsInteger.withDefault(10).withOptions({ shallow: false }),
  );
  const [categoryId, setCategoryId] = useQueryState(
    "categoryId",
    parseAsString.withOptions({ shallow: false }),
  );

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (from || to) {
      filters.push({
        id: "date",
        value: [from ? Number(from) : undefined, to ? Number(to) : undefined],
      });
    }
    // Mounted on the categoryName column but keyed by id, exactly as the expense
    // table does. Safe only because manualFiltering means the accessor value is
    // never compared client-side.
    if (categoryId) {
      filters.push({ id: "categoryName", value: categoryId.split(".") });
    }
    return filters;
  }, [from, to, categoryId]);

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

    const dateFilter = newFilters.find((f) => f.id === "date");
    if (dateFilter && Array.isArray(dateFilter.value)) {
      const [start, end] = dateFilter.value as (number | undefined)[];
      setFrom(start ? String(start) : null);
      setTo(end ? String(end) : null);
    } else {
      setFrom(null);
      setTo(null);
    }

    const categoryFilter = newFilters.find((f) => f.id === "categoryName");
    if (categoryFilter && Array.isArray(categoryFilter.value)) {
      setCategoryId(categoryFilter.value.join("."));
    } else {
      setCategoryId(null);
    }
  };

  const onGlobalFilterChange = (updater: Updater<string>) => {
    const newVal = typeof updater === "function" ? updater(search) : updater;
    setSearch(newVal);
  };

  const currentFilters: IncomeFilters = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    categoryId: categoryId || undefined,
  };

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
      pagination: { pageIndex: page - 1, pageSize: perPage },
      globalFilter: search,
    },
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const newState = updater({ pageIndex: page - 1, pageSize: perPage });
        setPage(newState.pageIndex + 1);
        setPerPage(newState.pageSize);
      }
    },
  });

  const pageTotal = data.reduce((sum, i) => sum + i.amount, 0);

  return (
    <DataTable
      table={table}
      actionBar={<IncomeTableFloatingBar table={table} />}
      paginationInfo={
        <DataTableAmountTotals
          pageTotal={pageTotal}
          total={total}
          totalAmount={totalAmount}
        />
      }
    >
      <IncomeTableToolbar
        table={table}
        filters={currentFilters}
        categoryOptions={categoryOptions}
      />
    </DataTable>
  );
}
