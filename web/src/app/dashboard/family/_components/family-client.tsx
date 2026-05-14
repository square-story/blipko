"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { getGroupData, createGroup } from "@/lib/actions/group";
import { GroupInviteSection } from "./group-invite-section";
import { MemberSpendCard } from "./member-spend-card";

type GroupData = {
  groupId: string;
  groupName: string;
  inviteCode: string;
  role: string;
  members: Array<{
    userId: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
};

export function FamilyClient({ currentUserId }: { currentUserId: string }) {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const res = await getGroupData();
      setGroup((res.data as GroupData) ?? null);
      setLoaded(true);
    });

  useEffect(() => { load(); }, []);

  const handleCreate = () =>
    startTransition(async () => {
      await createGroup();
      load();
    });

  const isAdmin = group?.role === "ADMIN";

  return (
    <ContentLayout title="Family">
      <div className="space-y-6">
        {!loaded && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {loaded && !group && (
          <div className="text-center py-16 space-y-4">
            <Users className="mx-auto h-12 w-12 opacity-30" />
            <p className="text-muted-foreground">No family group yet.</p>
            <p className="text-sm text-muted-foreground">
              Create one to track family expenses together, or ask your family
              head for an invite code and send it to the bot.
            </p>
            <Button onClick={handleCreate} disabled={isPending}>
              Create Family Group
            </Button>
          </div>
        )}

        {loaded && group && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">{group.groupName}</h2>
              <p className="text-sm text-muted-foreground">
                {group.members.length} member
                {group.members.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Members</h3>
                {group.members.map((m) => (
                  <MemberSpendCard
                    key={m.userId}
                    member={m}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                    onRemove={load}
                  />
                ))}
              </div>

              <div>
                <GroupInviteSection
                  inviteCode={group.inviteCode}
                  isAdmin={isAdmin}
                  onRefresh={load}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ContentLayout>
  );
}
