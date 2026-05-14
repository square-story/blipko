"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
} from "@/components/ui/responsive-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRecurringCharge } from "@/lib/actions/recurring";
import { getWallets } from "@/lib/actions/wallets";
import {
  createRecurringChargeSchema,
  type CreateRecurringChargeSchema,
} from "@/lib/validations/recurring";

type Wallet = { id: string; name: string; emoji: string };

interface RecurringChargeDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecurringChargeDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onSuccess,
}: RecurringChargeDialogProps) {
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;

  const onOpenChange = (value: boolean) => {
    if (isControlled && controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setOpen(value);
    }
  };

  useEffect(() => {
    getWallets().then((res) => {
      if (res.success) setWallets(res.data as Wallet[]);
    });
  }, []);

  const form = useForm<CreateRecurringChargeSchema>({
    resolver: zodResolver(createRecurringChargeSchema),
    defaultValues: {
      description: "",
      amount: undefined,
      direction: "EXPENSE",
      period: "MONTHLY",
      dayOfMonth: undefined,
      walletId: null,
      notifyDaysBefore: 2,
    },
  });

  async function onSubmit(data: CreateRecurringChargeSchema) {
    try {
      const result = await createRecurringCharge(data);
      if (result.success) {
        toast.success(result.message ?? "Recurring charge created");
        onOpenChange(false);
        form.reset();
        onSuccess?.();
      } else {
        toast.error(result.message ?? "Something went wrong");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <ResponsiveModal open={isOpen} onOpenChange={onOpenChange}>
      {trigger ? (
        <ResponsiveModalTrigger asChild>{trigger}</ResponsiveModalTrigger>
      ) : (
        !isControlled && (
          <ResponsiveModalTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Charge
            </Button>
          </ResponsiveModalTrigger>
        )
      )}
      <ResponsiveModalContent className="sm:max-w-[425px]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Add Recurring Charge</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Create a recurring income or expense. Dues will be generated automatically.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ScrollArea className="max-h-[80vh] px-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rent, Netflix" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="EXPENSE">Expense</SelectItem>
                          <SelectItem value="INCOME">Income</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day of Month (1–28)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="28"
                          placeholder="1"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notifyDaysBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notify Days Before</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="7"
                          placeholder="2"
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {wallets.length > 0 && (
                <FormField
                  control={form.control}
                  name="walletId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wallet (Optional)</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                        defaultValue={field.value ?? "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="No wallet" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No wallet</SelectItem>
                          {wallets.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.emoji} {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <ResponsiveModalFooter className="pb-4">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating…" : "Create charge"}
                </Button>
              </ResponsiveModalFooter>
            </form>
          </Form>
        </ScrollArea>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
