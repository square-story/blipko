"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { updateIncome, type IncomeData } from "@/lib/actions/income";
import {
  incomeEditSchema,
  type IncomeEditInput,
} from "@/lib/validations/income";
import type { CategoryStat } from "@/lib/actions/categories";
import { BUCKET_META } from "@/lib/budget";
import { toast } from "@/lib/toast";

const NONE = "__none__";

interface EditIncomeModalProps {
  income: IncomeData;
  categories: CategoryStat[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditIncomeModal({
  income,
  categories,
  open,
  onOpenChange,
}: EditIncomeModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateOpen, setDateOpen] = useState(false);

  // Income earmarks to a leaf category (a two-way "pot").
  const leaves = categories.filter(
    (c) => !c.isGroup || c.spend > 0 || c.received > 0 || c.monthlyBudget !== null,
  );

  const form = useForm<IncomeEditInput>({
    resolver: zodResolver(incomeEditSchema),
    defaultValues: {
      amount: income.amount,
      date: income.date,
      source: income.source ?? "",
      note: income.note ?? "",
      categoryId: income.categoryId ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: income.amount,
        date: income.date,
        source: income.source ?? "",
        note: income.note ?? "",
        categoryId: income.categoryId ?? undefined,
      });
    }
  }, [open, income, form]);

  const onSubmit = (data: IncomeEditInput) => {
    startTransition(async () => {
      const res = await updateIncome(income.id, data);
      if (!res.success) {
        toast.error(res.message ?? "Failed to update income");
        return;
      }
      toast.success("Income updated");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit Income</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update the amount, date, source, category, or note. Earmarking a
            category offsets that category&apos;s spend (a two-way pot).
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "PPP")
                              : "Pick a date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value}
                          onSelect={(d) => {
                            if (d) field.onChange(d);
                            setDateOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="salary, freelance, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select
                      value={field.value || NONE}
                      onValueChange={(val) =>
                        field.onChange(val === NONE ? undefined : val)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="General income" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None (general)</SelectItem>
                        {leaves.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {BUCKET_META[c.bucket].emoji} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional note" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ResponsiveModalFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                Save Changes
              </Button>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
