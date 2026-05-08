"use client";

import { useEffect, useState, useTransition } from "react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Wallet, Plus, Star, Trash2 } from "lucide-react";
import {
  getWallets,
  createWallet,
  setDefaultWallet,
  deleteWallet,
} from "@/lib/actions/wallets";

type WalletItem = {
  id: string;
  name: string;
  emoji: string;
  type: string;
  isDefault: boolean;
  transactionCount: number;
  createdAt: string;
};

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💰");
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const res = await getWallets();
      if (res.success) setWallets(res.data as WalletItem[]);
    });

  useEffect(() => { load(); }, []);

  const handleCreate = () =>
    startTransition(async () => {
      if (!name.trim()) return;
      const res = await createWallet({ name: name.trim(), emoji });
      if (res.success) {
        setOpen(false);
        setName("");
        setEmoji("💰");
        load();
      }
    });

  const handleSetDefault = (id: string) =>
    startTransition(async () => {
      await setDefaultWallet(id);
      load();
    });

  const handleDelete = (id: string) =>
    startTransition(async () => {
      await deleteWallet(id);
      load();
    });

  return (
    <ContentLayout title="Wallets">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Manage your wallets. Prefix messages with <code>WalletName:</code> to route transactions.
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Emoji</Label>
                  <Input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    maxLength={2}
                    className="w-16"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Shop, Savings"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <Button onClick={handleCreate} disabled={isPending} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => (
            <Card key={w.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <span className="text-xl">{w.emoji}</span>
                  {w.name}
                </CardTitle>
                {w.isDefault && <Badge variant="secondary">Default</Badge>}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {w.transactionCount} transaction{w.transactionCount !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  {!w.isDefault && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(w.id)}
                        disabled={isPending}
                      >
                        <Star className="mr-1 h-3 w-3" />
                        Set Default
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(w.id)}
                        disabled={isPending || w.transactionCount > 0}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {wallets.length === 0 && !isPending && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <Wallet className="mx-auto h-10 w-10 mb-3 opacity-30" />
              <p>No wallets yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}
