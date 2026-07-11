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
import { BoxEntryView, type BoxEntryFilters } from "@/lib/actions/boxes";
import { DataTable } from "@/components/data-table/data-table";
import { boxEntriesColumns } from "./box-entries-columns";
import { BoxEntriesToolbar } from "./box-entries-toolbar";
import { BoxEntriesFloatingBar } from "./box-entries-floating-bar";

interface BoxEntriesTableProps {
  boxId: string;
  data: BoxEntryView[];
  pageCount: number;
}

export function BoxEntriesTable({ boxId, data, pageCount }: BoxEntriesTableProps) {
  const opts = { shallow: false } as const;
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions(opts),
  );
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("").withOptions(opts),
  );
  const [sort, setSort] = useQueryState("sort", parseAsString.withOptions(opts));
  const [direction, setDirection] = useQueryState(
    "direction",
    parseAsString.withOptions(opts),
  );
  const [from, setFrom] = useQueryState("from", parseAsString.withOptions(opts));
  const [to, setTo] = useQueryState("to", parseAsString.withOptions(opts));
  const [perPage, setPerPage] = useQueryState(
    "perPage",
    parseAsInteger.withDefault(10).withOptions(opts),
  );

  const columnFilters = React.useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = [];
    if (from || to) {
      filters.push({
        id: "date",
        value: [from ? Number(from) : undefined, to ? Number(to) : undefined],
      });
    }
    if (direction) {
      filters.push({ id: "direction", value: direction.split(".") });
    }
    return filters;
  }, [from, to, direction]);

  const sorting: SortingState = React.useMemo(() => {
    if (!sort) return [];
    const [id, desc] = sort.split(".");
    return [{ id, desc: desc === "desc" }];
  }, [sort]);

  const onSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    if (next.length > 0) {
      const { id, desc } = next[0];
      setSort(`${id}.${desc ? "desc" : "asc"}`);
    } else {
      setSort(null);
    }
  };

  const onColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater;
    const dateFilter = next.find((f) => f.id === "date");
    if (dateFilter && Array.isArray(dateFilter.value)) {
      const [start, end] = dateFilter.value as (number | undefined)[];
      setFrom(start ? String(start) : null);
      setTo(end ? String(end) : null);
    } else {
      setFrom(null);
      setTo(null);
    }
    const dirFilter = next.find((f) => f.id === "direction");
    if (dirFilter && Array.isArray(dirFilter.value) && dirFilter.value.length) {
      setDirection((dirFilter.value as string[]).join("."));
    } else {
      setDirection(null);
    }
  };

  const onGlobalFilterChange = (updater: Updater<string>) => {
    setSearch(typeof updater === "function" ? updater(search) : updater);
  };

  const currentFilters: BoxEntryFilters = {
    boxId,
    search: search || undefined,
    direction: direction || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const table = useReactTable({
    data,
    columns: boxEntriesColumns,
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
        const next = updater({ pageIndex: page - 1, pageSize: perPage });
        setPage(next.pageIndex + 1);
        setPerPage(next.pageSize);
      }
    },
  });

  return (
    <DataTable table={table} actionBar={<BoxEntriesFloatingBar table={table} />}>
      <BoxEntriesToolbar table={table} filters={currentFilters} />
    </DataTable>
  );
}
