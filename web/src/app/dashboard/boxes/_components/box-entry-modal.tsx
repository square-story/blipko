"use client";

import { useState, useTransition } from "react";
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
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { addToBox, spendFromBox, type BoxView } from "@/lib/actions/boxes";
import { boxEntrySchema, type BoxEntryInput } from "@/lib/validations/box";
import { toast } from "@/lib/toast";

interface BoxEntryModalProps {
  box: BoxView;
  mode: "IN" | "OUT";
  onSaved: () => void;
  trigger: React.ReactNode;
}

export function BoxEntryModal({ box, mode, onSaved, trigger }: BoxEntryModalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isIn = mode === "IN";

  const form = useForm<BoxEntryInput>({
    resolver: zodResolver(boxEntrySchema),
    defaultValues: { amount: 0, note: "" },
  });

  const onSubmit = (data: BoxEntryInput) => {
    startTransition(async () => {
      const res = isIn
        ? await addToBox(box.id, data)
        : await spendFromBox(box.id, data);
      if (!res.success) {
        toast.error(res.error ?? "Failed to save");
        return;
      }
      toast.success(isIn ? "Added to box" : "Spent from box");
      form.reset({ amount: 0, note: "" });
      setOpen(false);
      onSaved();
    });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalTrigger asChild>{trigger}</ResponsiveModalTrigger>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {isIn ? "Add money" : "Spend"} · {box.name}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription>
            {isIn
              ? "Money into this box (a contribution or a gift toward it)."
              : "Money out of this box."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="5000"
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
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="from brother, tickets, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <ResponsiveModalFooter>
              <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                {isIn ? "Add money" : "Spend"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
