"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { Plus, Edit } from "lucide-react";
import {
  createRecurringRule,
  updateRecurringRule,
  type RecurringRuleView,
} from "@/lib/actions/recurring";
import {
  recurringRuleSchema,
  type RecurringRuleInput,
} from "@/lib/validations/recurring";
import { toast } from "@/lib/toast";
import type { CategoryStat } from "@/lib/actions/categories";
import type { BoxView } from "@/lib/actions/boxes";
import { CategoryCombobox } from "@/components/category-combobox";

interface RecurringFormModalProps {
  rule?: RecurringRuleView;
  categories: CategoryStat[];
  boxes: BoxView[];
  onSaved: () => void;
  trigger?: React.ReactNode;
}

export function RecurringFormModal({
  rule,
  categories,
  boxes,
  onSaved,
  trigger,
}: RecurringFormModalProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const isEditing = !!rule;

  const form = useForm<RecurringRuleInput>({
    resolver: zodResolver(recurringRuleSchema),
    defaultValues: {
      kind: rule?.kind ?? "EXPENSE",
      amount: rule?.amount ?? 0,
      dayOfMonth: rule?.dayOfMonth ?? 1,
      bucket: rule?.bucket ?? "NEEDS",
      categoryId: rule?.categoryId ?? undefined,
      boxId: rule?.boxId ?? undefined,
      note: rule?.note ?? "",
    },
  });

  const kind = form.watch("kind");

  useEffect(() => {
    if (open) {
      form.reset({
        kind: rule?.kind ?? "EXPENSE",
        amount: rule?.amount ?? 0,
        dayOfMonth: rule?.dayOfMonth ?? 1,
        bucket: rule?.bucket ?? "NEEDS",
        categoryId: rule?.categoryId ?? undefined,
        boxId: rule?.boxId ?? undefined,
        note: rule?.note ?? "",
      });
    }
  }, [open, rule, form]);

  const onSubmit = (data: RecurringRuleInput) => {
    startTransition(async () => {
      const res = isEditing
        ? await updateRecurringRule(rule.id, data)
        : await createRecurringRule(data);

      if (!res.success) {
        toast.error(res.error ?? "Failed to save recurring item");
        return;
      }

      if (isEditing) {
        toast.success("Updated recurring item");
      } else {
        toast.signature("Recurring set up", {
          description: "It'll post automatically each cycle",
        });
      }
      setOpen(false);
      onSaved();
    });
  };


  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Recurring
          </Button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {isEditing ? "Edit Recurring Item" : "Add Recurring Item"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            This item will automatically be logged on the specified day each month.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="BOX">Box</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="8000"
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
                name="dayOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Month (1–28)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {kind === "EXPENSE" && (
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category (Optional)</FormLabel>
                      <CategoryCombobox
                        categories={categories}
                        value={field.value}
                        onChange={(id, category) => {
                          field.onChange(id);
                          // Adopt the picked category's bucket.
                          if (category) form.setValue("bucket", category.bucket);
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {kind === "EXPENSE" && !form.watch("categoryId") && (
                <FormField
                  control={form.control}
                  name="bucket"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bucket</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NEEDS">Needs</SelectItem>
                          <SelectItem value="WANTS">Wants</SelectItem>
                          <SelectItem value="SAVINGS">Savings</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {kind === "BOX" && (
                <FormField
                  control={form.control}
                  name="boxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Box</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a box" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {boxes.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.icon ? `${b.icon} ` : ""}
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Rent, Salary, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ResponsiveModalFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isEditing ? "Save Changes" : "Add Item"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
