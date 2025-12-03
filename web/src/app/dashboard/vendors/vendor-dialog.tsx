"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { createVendor, updateVendor } from "@/lib/actions/vendors";
import { createVendorSchema, type CreateVendorSchema } from "@/lib/validations/vendor";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { VendorData } from "./vendor-table";

interface VendorDialogProps {
    vendor?: VendorData;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function VendorDialog({ vendor, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: VendorDialogProps) {
    const [open, setOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : open;

    const onOpenChange = (value: boolean) => {
        if (isControlled && controlledOnOpenChange) {
            controlledOnOpenChange(value);
        } else {
            setOpen(value);
        }
    };

    const isEditing = !!vendor;

    const form = useForm<CreateVendorSchema>({
        resolver: zodResolver(createVendorSchema),
        defaultValues: {
            name: vendor?.name || "",
            category: vendor?.category || "",
            status: (vendor?.status ?? "ACTIVE") as any,
            phoneNumber: vendor?.phoneNumber || "",
            email: vendor?.email || "",
            address: vendor?.address || "",
            notes: vendor?.notes || "",
        },
    });

    async function onSubmit(data: CreateVendorSchema) {
        try {
            if (isEditing && vendor) {
                const result = await updateVendor({ id: vendor.id, ...data });
                if (result.success) {
                    toast.success(result.message);
                    onOpenChange(false);
                } else {
                    toast.error(result.message);
                }
            } else {
                const result = await createVendor(data);
                if (result.success) {
                    toast.success(result.message);
                    onOpenChange(false);
                    form.reset();
                } else {
                    toast.error(result.message);
                }
            }
        } catch (error) {
            toast.error("Something went wrong");
            console.error(error);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            {trigger ? (
                <DialogTrigger asChild>{trigger}</DialogTrigger>
            ) : (
                !isControlled && (
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Vendor
                        </Button>
                    </DialogTrigger>
                )
            )}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Make changes to the vendor here. Click save when you're done."
                            : "Add a new vendor to your list. Click save when you're done."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Vendor Name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Category" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="ACTIVE">Active</SelectItem>
                                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                                <SelectItem value="ARCHIVED">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="phoneNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+91..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="vendor@example.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Address (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Address" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Any additional notes..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">{isEditing ? "Save changes" : "Create vendor"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
