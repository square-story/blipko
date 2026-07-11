"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmojiPickerField } from "@/components/emoji-picker-field";
import {
  createInlineCategory,
  type CategoryStat,
} from "@/lib/actions/categories";
import { BUCKETS, BUCKET_META } from "@/lib/budget";
import { resolveCategoryEmoji } from "@/lib/category-emoji";
import { Bucket } from "@prisma/client";
import { toast } from "@/lib/toast";

interface CategoryComboboxProps {
  categories: CategoryStat[];
  value?: string;
  onChange: (id: string | undefined, category: CategoryStat | null) => void;
  allowNone?: boolean;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

// Only leaf-ish categories are pickable (matches the app's shared predicate).
const isLeafLike = (c: CategoryStat) =>
  !c.isGroup || c.spend > 0 || c.monthlyBudget !== null;

export function CategoryCombobox({
  categories,
  value,
  onChange,
  allowNone = true,
  placeholder = "Select a category",
  disabled,
  triggerClassName,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Categories created inline this session — merged so they show + stay selected
  // without waiting on the parent to refetch.
  const [extra, setExtra] = useState<CategoryStat[]>([]);

  const leaves = useMemo(() => {
    const byId = new Map<string, CategoryStat>();
    for (const c of [...categories, ...extra]) byId.set(c.id, c);
    return [...byId.values()].filter(isLeafLike);
  }, [categories, extra]);

  const selected = leaves.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter((c) => c.name.toLowerCase().includes(q));
  }, [leaves, query]);

  const pick = (id: string | undefined, category: CategoryStat | null) => {
    onChange(id, category);
    setOpen(false);
    setQuery("");
  };

  const onCreated = (category: CategoryStat) => {
    setExtra((prev) => [...prev, category]);
    onChange(category.id, category);
    setCreateOpen(false);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", triggerClassName)}
          >
            <span className="truncate">
              {selected
                ? `${selected.icon ?? BUCKET_META[selected.bucket].emoji} ${selected.name}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandGroup>
                {allowNone && !query && (
                  <CommandItem value="__none__" onSelect={() => pick(undefined, null)}>
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        !value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="text-muted-foreground">None</span>
                  </CommandItem>
                )}
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => pick(c.id, c)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        c.id === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {c.icon ?? BUCKET_META[c.bucket].emoji} {c.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  {query.trim()
                    ? `Create "${query.trim()}"`
                    : "Create new category"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CategoryCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={query.trim()}
        onCreated={onCreated}
      />
    </>
  );
}

function CategoryCreateDialog({
  open,
  onOpenChange,
  initialName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onCreated: (category: CategoryStat) => void;
}) {
  const [name, setName] = useState(initialName);
  const [bucket, setBucket] = useState<Bucket>("NEEDS");
  const [pickedIcon, setPickedIcon] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset fields whenever the dialog (re)opens with a fresh initial name.
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(initialName);
      setBucket("NEEDS");
      setPickedIcon(null);
    }
  }

  const icon = pickedIcon ?? resolveCategoryEmoji(name || "category");

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await createInlineCategory(name.trim(), bucket, icon);
      if (!res.success || !res.category) {
        toast.error(res.message ?? "Failed to create category");
        return;
      }
      toast.success(`Created "${res.category.name}"`);
      onCreated(res.category);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Add a category and its 50/30/20 bucket.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <EmojiPickerField value={icon} onChange={setPickedIcon} />
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries"
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Bucket</label>
            <Select value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUCKETS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BUCKET_META[b].emoji} {BUCKET_META[b].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={isPending} className="w-full sm:w-auto">
            Create category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
