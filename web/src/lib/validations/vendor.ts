import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  category: z.string().min(1, "Category is required").max(50),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  phoneNumber: z.string().max(20).optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255)
    .optional()
    .or(z.literal("")),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  id: z.string().min(1, "ID is required"),
});

export type CreateVendorSchema = z.infer<typeof createVendorSchema>;
export type UpdateVendorSchema = z.infer<typeof updateVendorSchema>;
