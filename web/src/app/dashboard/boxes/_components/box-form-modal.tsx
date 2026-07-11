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
  FormDescription,
} from "@/components/ui/form";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { Plus } from "lucide-react";
import { EmojiPickerField } from "@/components/emoji-picker-field";
import { CategoryCombobox } from "@/components/category-combobox";
import { createBox, updateBox, type BoxView } from "@/lib/actions/boxes";
import { boxSchema, type BoxInput } from "@/lib/validations/box";
import { toast } from "@/lib/toast";
import type { CategoryStat } from "@/lib/actions/categories";

interface BoxFormModalProps {
  box?: BoxView;
  categories: CategoryStat[];
  onSaved: () => void;
  trigger?: React.ReactNode;
}

export function BoxFormModal({ box, categories, onSaved, trigger }: BoxFormModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEditing = !!box;

  const defaults = (): BoxInput => ({
    name: box?.name ?? "",
    icon: box?.icon ?? "",
    targetAmount: box?.targetAmount ?? undefined,
    priority: box?.priority ?? 0,
    categoryId: box?.categoryId ?? undefined,
  });

  const form = useForm<BoxInput>({
    resolver: zodResolver(boxSchema),
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, box]);

  const onSubmit = (data: BoxInput) => {
    startTransition(async () => {
      const res = isEditing
        ? await updateBox(box.id, data)
        : await createBox(data);
      if (!res.success) {
        toast.error(res.error ?? "Failed to save box");
        return;
      }
      toast.success(isEditing ? "Box updated" : "Box created");
      setOpen(false);
      onSaved();
    });
  };


  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Box
          </Button>
        )}
      </ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {isEditing ? "Edit Box" : "New Box"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            A box is an isolated pot — a savings goal or a shared fund. It never
            resets and stays out of your monthly 50/30/20 budget.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Trip to New York" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emoji (Optional)</FormLabel>
                    <div>
                      <EmojiPickerField
                        value={field.value || "📦"}
                        onChange={field.onChange}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="200000"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      We&apos;ll notify you when it&apos;s reached.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Lower shows first.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked category (Optional)</FormLabel>
                  <CategoryCombobox
                    categories={categories}
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                    placeholder="None"
                  />
                  <FormDescription>
                    Spending you log to this category flows into the box instead
                    of your budget.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ResponsiveModalFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isEditing ? "Save Changes" : "Create Box"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
