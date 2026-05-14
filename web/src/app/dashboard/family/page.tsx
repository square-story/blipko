import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FamilyClient } from "./_components/family-client";

export default async function FamilyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return <FamilyClient currentUserId={session.user.id} />;
}
