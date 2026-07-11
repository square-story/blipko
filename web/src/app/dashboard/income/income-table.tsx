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
import { IncomeData, IncomeFilters } from "@/lib/actions/income";
import { DataTable } from "@/components/data-table/data-table";
import { columns } from "./_components/columns";
import { IncomeTableToolbar } from "./_components/income-table-toolbar";
import { IncomeTableFloatingBar } from "./_components/income-table-floating-bar";

interface IncomeTableProps {
  data: IncomeData[];
  pageCount: number;
  total: number;
}

export function IncomeTable({ data, pageCount }: IncomeTableProps) {
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

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (from || to) {
      filters.push({
        id: "date",
        value: [from ? Number(from) : undefined, to ? Number(to) : undefined],
      });
    }
    return filters;
  }, [from, to]);

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

  const currentFilters: IncomeFilters = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
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

  return (
    <DataTable table={table} actionBar={<IncomeTableFloatingBar table={table} />}>
      <IncomeTableToolbar table={table} filters={currentFilters} />
    </DataTable>
  );
}
