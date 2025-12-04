"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function completeOnboarding() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      hasOnboarded: true,
    },
  });

  revalidatePath("/dashboard");
  return { success: true };
}
