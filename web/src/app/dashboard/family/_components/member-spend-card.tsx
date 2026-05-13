"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserX, ChevronRight } from "lucide-react";
import { useTransition } from "react";
import { removeMember } from "@/lib/actions/group";

type Member = {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
};

export function MemberSpendCard({
  member,
  isAdmin,
  currentUserId,
  onRemove,
}: {
  member: Member;
  isAdmin: boolean;
  currentUserId: string;
  onRemove: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isSelf = member.userId === currentUserId;

  const handleRemove = () =>
    startTransition(async () => {
      await removeMember(member.userId);
      onRemove();
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {member.name}
          {isSelf && (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          )}
        </CardTitle>
        <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>
          {member.role}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Joined {new Date(member.joinedAt).toLocaleDateString("en-IN")}
        </p>
        <div className="flex gap-2">
          {isAdmin && !isSelf && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={handleRemove}
                disabled={isPending}
              >
                <UserX className="h-3 w-3" />
              </Button>
              <Link href={`/dashboard/family/${member.userId}`}>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
