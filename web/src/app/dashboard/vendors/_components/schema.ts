import { z } from "zod";

export const contactStatusSchema = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

export const vendorDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  status: contactStatusSchema,
  totalSpend: z.number(),
  lastTransaction: z.date().optional(),
  transactionCount: z.number(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  currentBalance: z.number(),
});

export type VendorData = z.infer<typeof vendorDataSchema>;
