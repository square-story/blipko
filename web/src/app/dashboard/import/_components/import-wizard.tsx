"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryCombobox } from "@/components/category-combobox";
import type { CategoryStat } from "@/lib/actions/categories";
import type { IncomeCategoryOption } from "@/lib/actions/income";
import {
  commitImport,
  previewImport,
  undoImport,
} from "@/lib/actions/import";
import { parseCsv } from "@/lib/import/csv";
import {
  type Mapping,
  type StatementTxn,
  detectColumns,
  toTransactions,
} from "@/lib/import/statement";
import { INCOME_FALLBACK_CATEGORY, formatMoney } from "@/lib/budget";
import { toast } from "@/lib/toast";

const MAX_ROWS = 1000;

interface Item {
  txn: StatementTxn;
  duplicate: boolean;
  include: boolean;
  categoryId: string | null;
  incomeCategoryId: string | null;
}

// Manual column mapping, only when the header can't be recognised.
type ManualMap = { date?: number; description?: number; debit?: number; credit?: number };

export function ImportWizard({
  categories,
  incomeCategories,
}: {
  categories: CategoryStat[];
  incomeCategories: IncomeCategoryOption[];
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [manual, setManual] = useState<ManualMap>({});
  const [items, setItems] = useState<Item[] | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const fallbackIncome =
    incomeCategories.find((c) => c.name === INCOME_FALLBACK_CATEGORY)?.id ??
    null;

  // The header for manual mapping: the first row with 3+ filled cells.
  const headerRow = useMemo(
    () =>
      rows ? rows.findIndex((r) => r.filter((c) => c.trim()).length >= 3) : -1,
    [rows],
  );

  const preview = (all: string[][], mapping: Mapping) => {
    const { txns, skipped } = toTransactions(all, mapping);
    if (txns.length === 0) {
      toast.error("No transactions found — check the columns.");
      return;
    }
    if (txns.length > MAX_ROWS) {
      toast.error(`That's ${txns.length} rows — import up to ${MAX_ROWS} at a time.`);
      return;
    }
    startTransition(async () => {
      const res = await previewImport(txns);
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      setItems(
        txns.map((txn, i) => ({
          txn,
          ...res.rows[i]!,
          incomeCategoryId: txn.kind === "CREDIT" ? fallbackIncome : null,
        })),
      );
      if (skipped > 0) toast.info(`${skipped} rows without a date or amount were skipped.`);
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    // Parsed here, in the browser: the statement itself never leaves the device.
    const parsed = parseCsv(await file.text());
    setItems(null);
    setDone(false);
    setManual({});
    setRows(parsed);
    const mapping = detectColumns(parsed);
    if (mapping) preview(parsed, mapping);
  };

  const applyManual = () => {
    const { date, description, debit, credit } = manual;
    if (!rows || date === undefined || description === undefined || debit === undefined || credit === undefined) {
      toast.error("Pick all four columns.");
      return;
    }
    preview(rows, { headerRow, date, description, debit, credit });
  };

  // A pick applies to every row from the same payee: 12 Swiggy rows, one choice.
  const setCategory = (payee: string, kind: StatementTxn["kind"], id: string | null) =>
    setItems((cur) =>
      cur!.map((it) =>
        it.txn.payee === payee && it.txn.kind === kind
          ? kind === "DEBIT"
            ? { ...it, categoryId: id }
            : { ...it, incomeCategoryId: id }
          : it,
      ),
    );

  const toggle = (i: number, on: boolean) =>
    setItems((cur) => cur!.map((it, j) => (j === i ? { ...it, include: on } : it)));

  const onImport = () => {
    const chosen = items!.filter((it) => it.include);
    if (chosen.length === 0) {
      toast.error("Nothing ticked to import.");
      return;
    }
    startTransition(async () => {
      const res = await commitImport(
        chosen.map(({ txn, categoryId, incomeCategoryId }) => ({
          txn,
          categoryId,
          incomeCategoryId,
        })),
      );
      if (!res.success) {
        toast.error(res.message);
        return;
      }
      const { batchId } = res;
      const parts = [
        res.expenses && `${res.expenses} expense${res.expenses === 1 ? "" : "s"}`,
        res.income && `${res.income} income`,
      ].filter(Boolean);
      toast.success(`Imported ${parts.join(" and ")}`, {
        duration: 15_000,
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = await undoImport(batchId);
            if (undo.success) toast.success("Import undone");
            else toast.error(undo.message);
          },
        },
      });
      setItems(null);
      setRows(null);
      setDone(true);
    });
  };

  const counts = useMemo(() => {
    if (!items) return null;
    const isNew = (it: Item) => it.txn.kind === "DEBIT" && !it.txn.cash && !it.duplicate;
    return {
      fresh: items.filter(isNew).length,
      logged: items.filter((it) => it.duplicate).length,
      unticked: items.filter((it) => !it.duplicate && (it.txn.kind === "CREDIT" || it.txn.cash)).length,
      selected: items.filter((it) => it.include).length,
    };
  }, [items]);

  const header = rows && headerRow >= 0 ? rows[headerRow]! : [];
  const needsMapping = rows && !items && !pending && !detectColumns(rows);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import a bank statement</CardTitle>
          <CardDescription>
            Download your statement as CSV from net banking (Excel files: open
            and Save As CSV). It&apos;s read in your browser — only the
            transactions you import are saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label
            htmlFor="statement"
            className="flex w-fit cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Upload className="size-4" />
            {pending ? "Reading…" : "Choose CSV file"}
          </Label>
          <input
            id="statement"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {done && (
            <p className="text-sm text-muted-foreground">
              Done. See them under{" "}
              <Link href="/dashboard/expenses" className="underline">
                Transactions
              </Link>
              ; uncategorised ones are waiting in the needs-review list on the
              dashboard.
            </p>
          )}
        </CardContent>
      </Card>

      {needsMapping && (
        <Card>
          <CardHeader>
            <CardTitle>Which columns are which?</CardTitle>
            <CardDescription>
              We couldn&apos;t recognise this bank&apos;s layout. Pick the
              columns once.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["date", "Date"],
                ["description", "Description"],
                ["debit", "Withdrawal / debit"],
                ["credit", "Deposit / credit"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Select
                  value={manual[key]?.toString()}
                  onValueChange={(v) => setManual((m) => ({ ...m, [key]: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a column" />
                  </SelectTrigger>
                  <SelectContent>
                    {header.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h.trim() || `Column ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button onClick={applyManual} className="sm:col-span-2 w-fit">
              Read statement
            </Button>
          </CardContent>
        </Card>
      )}

      {items && counts && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Review</CardTitle>
              <CardDescription>
                {counts.fresh} new · {counts.logged} already logged ·{" "}
                {counts.unticked} credits &amp; cash (unticked)
              </CardDescription>
            </div>
            <Button onClick={onImport} disabled={pending || counts.selected === 0}>
              {pending ? "Importing…" : `Import ${counts.selected}`}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Date</TableHead>
                  <TableHead>Payee</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i} className={it.include ? "" : "opacity-60"}>
                    <TableCell>
                      <Checkbox
                        checked={it.include}
                        onCheckedChange={(v) => toggle(i, v === true)}
                        aria-label={`Import ${it.txn.payee}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{it.txn.date}</TableCell>
                    <TableCell className="max-w-56 truncate" title={it.txn.narration}>
                      {it.txn.payee}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${it.txn.kind === "CREDIT" ? "text-emerald-600" : ""}`}
                    >
                      {it.txn.kind === "CREDIT" ? "+" : ""}
                      {formatMoney(it.txn.amount)}
                    </TableCell>
                    <TableCell className="min-w-48">
                      {it.txn.kind === "DEBIT" ? (
                        <CategoryCombobox
                          categories={categories}
                          value={it.categoryId ?? undefined}
                          onChange={(id) => setCategory(it.txn.payee, "DEBIT", id ?? null)}
                          placeholder="Uncategorised"
                        />
                      ) : (
                        <Select
                          value={it.incomeCategoryId ?? undefined}
                          onValueChange={(v) => setCategory(it.txn.payee, "CREDIT", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={INCOME_FALLBACK_CATEGORY} />
                          </SelectTrigger>
                          <SelectContent>
                            {incomeCategories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {it.duplicate ? (
                        <Badge variant="secondary">Already logged?</Badge>
                      ) : it.txn.cash ? (
                        <Badge variant="outline">Cash withdrawal</Badge>
                      ) : it.txn.kind === "CREDIT" ? (
                        <Badge variant="outline">Credit</Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
