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
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { updateExpense, type ExpenseData } from "@/lib/actions/expenses";
import {
  expenseEditSchema,
  type ExpenseEditInput,
} from "@/lib/validations/expense";
import type { CategoryStat } from "@/lib/actions/categories";
import { CategoryCombobox } from "@/components/category-combobox";
import { toast } from "@/lib/toast";

interface EditExpenseModalProps {
  expense: ExpenseData;
  categories: CategoryStat[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditExpenseModal({
  expense,
  categories,
  open,
  onOpenChange,
}: EditExpenseModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateOpen, setDateOpen] = useState(false);

  const form = useForm<ExpenseEditInput>({
    resolver: zodResolver(expenseEditSchema),
    defaultValues: {
      amount: expense.amount,
      date: expense.date,
      categoryId: expense.categoryId ?? undefined,
      note: expense.note ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: expense.amount,
        date: expense.date,
        categoryId: expense.categoryId ?? undefined,
        note: expense.note ?? "",
      });
    }
  }, [open, expense, form]);

  const onSubmit = (data: ExpenseEditInput) => {
    startTransition(async () => {
      const res = await updateExpense(expense.id, data);
      if (!res.success) {
        toast.error(res.message ?? "Failed to update expense");
        return;
      }
      toast.success(
        res.movedToBox ? `Moved to "${res.movedToBox}"` : "Expense updated",
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Edit Expense</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Update the amount, date, category, or note for this expense.
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
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <CategoryCombobox
                      categories={categories}
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                    />
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
                    <Input placeholder="chai, groceries, etc." {...field} />
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
