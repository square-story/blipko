"use server";

import { prisma } from "@/lib/prisma";
import {
  createVendorSchema,
  updateVendorSchema,
} from "@/lib/validations/vendor";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

export async function createVendor(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Unauthorized" };
  }

  const result = createVendorSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      message: "Invalid data",
      errors: result.error.flatten(),
    };
  }

  try {
    const vendor = await prisma.contact.create({
      data: {
        ...result.data,
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard/vendors");
    return {
      success: true,
      message: "Vendor created successfully",
      data: vendor,
    };
  } catch (error) {
    console.error("Error creating vendor:", error);
    return { success: false, message: "Failed to create vendor" };
  }
}

export async function updateVendor(data: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Unauthorized" };
  }

  const result = updateVendorSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      message: "Invalid data",
      errors: result.error.flatten(),
    };
  }

  const { id, ...updateData } = result.data;

  try {
    // Ensure the vendor belongs to the user
    const existingVendor = await prisma.contact.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existingVendor) {
      return { success: false, message: "Vendor not found" };
    }

    const vendor = await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/dashboard/vendors");
    return {
      success: true,
      message: "Vendor updated successfully",
      data: vendor,
    };
  } catch (error) {
    console.error("Error updating vendor:", error);
    return { success: false, message: "Failed to update vendor" };
  }
}

export async function deleteVendor(id: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    // Ensure the vendor belongs to the user
    const existingVendor = await prisma.contact.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existingVendor) {
      return { success: false, message: "Vendor not found" };
    }

    await prisma.contact.delete({
      where: { id },
    });

    revalidatePath("/dashboard/vendors");
    return { success: true, message: "Vendor deleted successfully" };
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return { success: false, message: "Failed to delete vendor" };
  }
}
