import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  phoneNumber: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  id: z.string().min(1, "ID is required"),
});

export type CreateVendorSchema = z.infer<typeof createVendorSchema>;
export type UpdateVendorSchema = z.infer<typeof updateVendorSchema>;
